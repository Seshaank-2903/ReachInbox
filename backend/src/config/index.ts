import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_scheduler?schema=public',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwtSecret: process.env.JWT_SECRET || 'reachinbox_scheduler_super_secret_jwt_key_2026',
  sessionSecret: process.env.SESSION_SECRET || 'reachinbox_scheduler_session_secret',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/auth/google/callback',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  minDelayBetweenEmailsMs: parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000', 10),
  maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100', 10),
};
