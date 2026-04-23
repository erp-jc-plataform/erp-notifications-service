import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { logger } from '@shared/utils/logger';
import { config } from '@shared/config/config';

export class SocketServer {
  private io: SocketIOServer;
  private redisClient: Redis;
  private subClient: Redis;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      path: config.socketIO.path,
      cors: {
        origin: config.socketIO.corsOrigin,
        credentials: true
      },
      pingTimeout: config.socketIO.pingTimeout,
      pingInterval: config.socketIO.pingInterval
    });

    this.setupRedisAdapter();
  }

  private async setupRedisAdapter(): Promise<void> {
    try {
      this.redisClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined
      });

      this.subClient = this.redisClient.duplicate();

      this.io.adapter(createAdapter(this.redisClient, this.subClient));

      logger.info('Redis adapter configured for Socket.IO');
    } catch (error: any) {
      logger.error('Failed to setup Redis adapter:', error);
      throw error;
    }
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public setupMiddleware(
    middleware: (socket: Socket, next: (err?: Error) => void) => void
  ): void {
    this.io.use(middleware);
  }

  public onConnection(handler: (socket: Socket) => void): void {
    this.io.on('connection', handler);
  }

  public emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public emitToRoom(room: string, event: string, data: any): void {
    this.io.to(room).emit(event, data);
  }

  public broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }

  public async close(): Promise<void> {
    try {
      this.io.close();
      await Promise.all([
        this.redisClient.quit(),
        this.subClient.quit()
      ]);
      logger.info('Socket.IO server closed');
    } catch (error: any) {
      logger.error('Error closing Socket.IO server:', error);
      throw error;
    }
  }

  public getConnectedSockets(): Promise<Set<string>> {
    return this.io.allSockets();
  }
}
