import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { config } from './config';
import routes from './routes';
import { EtherealService } from './services/ethereal.service';
import { ReconciliationService } from './services/reconciliation.service';

const app = express();

app.use(
  cors({
    origin: [config.frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// Mount API routes
app.use('/', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    // 1. Bootstrap default Ethereal sender
    await EtherealService.bootstrapDefaultSender();

    // 2. Run startup reconciliation check for orphan PENDING jobs
    await ReconciliationService.reconcilePendingJobs();

    app.listen(config.port, '0.0.0.0', () => {
      console.log('====================================================');
      console.log(`[API Server] ReachInbox Backend running on port ${config.port}`);
      console.log(`[API Server] Frontend URL configured as: ${config.frontendUrl}`);
      console.log('====================================================');
    });
  } catch (error: any) {
    console.error('\n[API Server] Initialization Error:', error?.message || error);
    console.error('\n👉 HOW TO RESOLVE:');
    console.error('PostgreSQL (port 5432) or Redis (port 6379) is not running on your machine yet.');
    console.error('1. Make sure Docker Desktop is opened & running, then run: docker compose up -d');
    console.error('2. Alternatively, start local PostgreSQL (database: reachinbox_scheduler) and Redis services.');
    console.error('3. Run `npx prisma db push` inside backend directory to create database tables.\n');
    process.exit(1);
  }
}

startServer();
