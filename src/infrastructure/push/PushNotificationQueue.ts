import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PushSubscription } from '@domain/entities/PushSubscription';
import { Notification } from '@domain/entities/Notification';
import { ISubsriptionRepository } from '@domain/repositories/IPushSubscriptionRepository';
import { WebPushProvider } from './WebPushProvider';
import { FCMProvider } from './FCMProvider';
import { config } from '@shared/config/config';
import { logger } from '@shared/utils/logger';

export interface PushNotificationJob {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  data?: any;
  icon?: string;
  image?: string;
  badge?: string;
  actions?: Array<{ action: string; title: string }>;
}

export class PushNotificationQueue {
  private queue: Queue<PushNotificationJob>;
  private worker: Worker<PushNotificationJob>;
  private webPushProvider: WebPushProvider;
  private fcmProvider: FCMProvider;

  constructor(private readonly subscriptionRepository: ISubsriptionRepository) {
    const connection = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: null
    });

    this.queue = new Queue<PushNotificationJob>('push-notifications', {
      connection: connection as any
    });

    this.webPushProvider = new WebPushProvider();
    this.fcmProvider = new FCMProvider();

    this.worker = new Worker<PushNotificationJob>(
      'push-notifications',
      async (job: Job<PushNotificationJob>) => this.processJob(job),
      {
        connection: connection as any,
        concurrency: 10,
        limiter: {
          max: 100,
          duration: 1000 // 100 jobs per second
        }
      }
    );

    this.setupWorkerEvents();
  }

  private setupWorkerEvents(): void {
    this.worker.on('completed', (job) => {
      logger.info(`Push notification job ${job.id} completed`);
    });

    this.worker.on('failed', (job, error) => {
      logger.error(`Push notification job ${job?.id} failed:`, error);
    });
  }

  private async processJob(job: Job<PushNotificationJob>): Promise<void> {
    const { userId, title, message, data, icon, image, badge, actions } = job.data;

    try {
      // Get active subscriptions for user
      const subscriptions = await this.subscriptionRepository.findActiveByUserId(userId);

      if (subscriptions.length === 0) {
        logger.info(`No active push subscriptions for user ${userId}`);
        return;
      }

      const payload = { title, message, data, icon, image, badge, actions };

      // Separate Web Push and FCM subscriptions
      const webPushSubs = subscriptions.filter(s => s.isWebPush());
      const fcmSubs = subscriptions.filter(s => s.isFCM());

      // Send Web Push notifications
      if (webPushSubs.length > 0) {
        const webResult = await this.webPushProvider.sendBatch(webPushSubs, payload);

        // Update subscriptions based on results
        for (const subId of webResult.successful) {
          const sub = subscriptions.find(s => s.id === subId);
          if (sub) {
            sub.recordSuccess();
            await this.subscriptionRepository.update(sub);
          }
        }

        for (const failed of webResult.failed) {
          const sub = subscriptions.find(s => s.id === failed.id);
          if (sub) {
            if (failed.error === 'SUBSCRIPTION_EXPIRED') {
              sub.deactivate();
            } else {
              sub.recordFailure(failed.error);
            }
            await this.subscriptionRepository.update(sub);
          }
        }
      }

      // Send FCM notifications
      if (fcmSubs.length > 0) {
        const fcmResult = await this.fcmProvider.sendBatch(fcmSubs, payload);

        // Update subscriptions based on results
        for (const subId of fcmResult.successful) {
          const sub = subscriptions.find(s => s.id === subId);
          if (sub) {
            sub.recordSuccess();
            await this.subscriptionRepository.update(sub);
          }
        }

        for (const failed of fcmResult.failed) {
          const sub = subscriptions.find(s => s.id === failed.id);
          if (sub) {
            if (failed.error === 'SUBSCRIPTION_EXPIRED') {
              sub.deactivate();
            } else {
              sub.recordFailure(failed.error);
            }
            await this.subscriptionRepository.update(sub);
          }
        }
      }

      logger.info(
        `Push notifications sent to user ${userId}: ${webPushSubs.length} Web Push, ${fcmSubs.length} FCM`
      );
    } catch (error: any) {
      logger.error('Error processing push notification job:', error);
      throw error;
    }
  }

  async enqueue(notification: Notification): Promise<void> {
    const job: PushNotificationJob = {
      notificationId: notification.id,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      data: {
        ...notification.metadata,
        notificationId: notification.id,
        type: notification.type,
        priority: notification.priority
      },
      icon: notification.iconUrl,
      image: notification.imageUrl,
      actions: notification.actions?.map(a => ({ action: a.action || '', title: a.label }))
    };

    await this.queue.add('push-notification', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: 100,
      removeOnFail: 50
    });

    logger.info(`Push notification queued for user ${notification.userId}`);
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    logger.info('Push notification queue closed');
  }
}
