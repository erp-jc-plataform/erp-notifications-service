import { MongoClient, Db, Collection, Document } from 'mongodb';
import { config } from '@shared/config/config';
import { logger } from '@shared/utils/logger';

export class MongoDatabase {
  private static instance: MongoDatabase;
  private client: MongoClient | null = null;
  private db: Db | null = null;

  private constructor() {}

  public static getInstance(): MongoDatabase {
    if (!MongoDatabase.instance) {
      MongoDatabase.instance = new MongoDatabase();
    }
    return MongoDatabase.instance;
  }

  public async connect(): Promise<void> {
    try {
      this.client = new MongoClient(config.mongodb.uri);
      await this.client.connect();
      this.db = this.client.db(config.mongodb.dbName);

      logger.info(`Connected to MongoDB: ${config.mongodb.dbName}`);

      // Create indexes
      await this.createIndexes();
    } catch (error: any) {
      logger.error('MongoDB connection error:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      // Notifications collection indexes
      const notificationsCollection = this.getCollection('notifications');
      await notificationsCollection.createIndex({ userId: 1, createdAt: -1 });
      await notificationsCollection.createIndex({ userId: 1, isRead: 1 });
      await notificationsCollection.createIndex({ userId: 1, type: 1 });
      await notificationsCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL
      await notificationsCollection.createIndex({ expiresAt: 1 });

      // User preferences collection indexes
      const preferencesCollection = this.getCollection('user_preferences');
      await preferencesCollection.createIndex({ userId: 1 }, { unique: true });

      // Push subscriptions collection indexes
      const subscriptionsCollection = this.getCollection('push_subscriptions');
      await subscriptionsCollection.createIndex({ userId: 1 });
      await subscriptionsCollection.createIndex({ endpoint: 1 }, { sparse: true });
      await subscriptionsCollection.createIndex({ fcmToken: 1 }, { sparse: true });
      await subscriptionsCollection.createIndex({ userId: 1, isActive: 1 });
      await subscriptionsCollection.createIndex({ lastUsedAt: 1 });

      logger.info('MongoDB indexes created');
    } catch (error: any) {
      logger.error('Error creating MongoDB indexes:', error);
    }
  }

  public getDatabase(): Db {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }

  public getCollection<T extends Document = Document>(name: string): Collection<T> {
    return this.getDatabase().collection<T>(name);
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      logger.info('MongoDB disconnected');
    }
  }

  public async ping(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.admin().ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}
