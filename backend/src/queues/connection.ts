import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { config } from '../config';

// In-Memory Redis Engine Fallback for Zero-Docker Standalone Mode
let connectionInstance: any;

try {
  // Attempt real Redis if configured
  if (process.env.USE_REAL_REDIS === 'true') {
    connectionInstance = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  } else {
    connectionInstance = new RedisMock();
  }
} catch (e) {
  connectionInstance = new RedisMock();
}

export const redisConnection = connectionInstance;
