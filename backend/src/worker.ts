import { createEmailWorker } from './queues/email.worker';
import { EtherealService } from './services/ethereal.service';
import { ReconciliationService } from './services/reconciliation.service';
import { config } from './config';

async function startWorkerProcess() {
  console.log('----------------------------------------------------');
  console.log('[Worker Process] Initializing ReachInbox BullMQ Worker...');
  console.log(`[Worker Process] Concurrency level: ${config.workerConcurrency}`);
  console.log(`[Worker Process] Minimum inter-send delay: ${config.minDelayBetweenEmailsMs}ms`);
  console.log(`[Worker Process] Max hourly emails per sender: ${config.maxEmailsPerHourPerSender}`);
  console.log('----------------------------------------------------');

  try {
    // 1. Ensure test sender is ready
    await EtherealService.bootstrapDefaultSender();

    // 2. Perform boot reconciliation for pending jobs
    await ReconciliationService.reconcilePendingJobs();

    // 3. Launch BullMQ worker thread pool
    const worker = createEmailWorker();

    console.log('[Worker Process] BullMQ Worker process is actively listening for delayed email jobs.');

    const gracefulShutdown = async (signal: string) => {
      console.log(`[Worker Process] Received ${signal}. Shutting down worker pool...`);
      if (worker) {
        await worker.close();
      }
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error: any) {
    console.error('\n[Worker Process] Initialization Error:', error?.message || error);
    console.error('\n👉 HOW TO RESOLVE:');
    console.error('PostgreSQL (port 5432) or Redis (port 6379) is not running on your machine yet.');
    console.error('1. Make sure Docker Desktop is opened & running, then run: docker compose up -d');
    console.error('2. Alternatively, start local PostgreSQL and Redis services.');
    console.error('3. Run `npx prisma db push` inside backend directory to create database tables.\n');
    process.exit(1);
  }
}

startWorkerProcess();
