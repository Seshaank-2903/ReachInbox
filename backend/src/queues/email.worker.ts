import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobPayload, emailQueue, registerWorkerProcessor } from './email.queue';
import { redisConnection } from './connection';
import { prisma } from '../db/prisma';
import { EtherealService } from '../services/ethereal.service';
import { RateLimiterService } from '../services/ratelimit.service';
import { config } from '../config';

export function createEmailWorker() {
  const processor = async (job: { id: string; data: EmailJobPayload; moveToDelayed?: (ms: number, token: string) => Promise<void> }, token?: string) => {
    const { emailJobId, senderId, recipientEmail, subject, body } = job.data;
    console.log(`[Worker] Picked up job ${job.id} for EmailJob ${emailJobId} -> ${recipientEmail}`);

    // 1. Fetch EmailJob from Database
    const emailJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
    });

    if (!emailJob) {
      console.warn(`[Worker] EmailJob ${emailJobId} not found in database. Skipping.`);
      return;
    }

    // 2. Idempotency guard: Skip if already SENT or CANCELLED
    if (emailJob.status === 'SENT' || emailJob.status === 'CANCELLED') {
      console.log(
        `[Worker] EmailJob ${emailJobId} is already in state '${emailJob.status}'. Idempotency guard skipping send.`
      );
      return;
    }

    // 3. Hourly Rate Limit Check per sender
    const limitCheck = await RateLimiterService.checkHourlyLimit(
      senderId,
      config.maxEmailsPerHourPerSender,
      new Date()
    );

    if (!limitCheck.allowed && limitCheck.nextAvailableTime) {
      const delayUntilNextWindow = Math.max(
        1000,
        limitCheck.nextAvailableTime.getTime() - Date.now()
      );

      console.log(
        `[Worker] Hourly limit (${config.maxEmailsPerHourPerSender}/hr) reached for sender ${senderId}. Rescheduling job ${emailJobId} to next window at ${limitCheck.nextAvailableTime.toISOString()} (+${delayUntilNextWindow}ms delay)`
      );

      // Update DB scheduled time to next window
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          scheduledTime: limitCheck.nextAvailableTime,
        },
      });

      // Move job to delayed state in BullMQ or in-memory queue
      if (job.moveToDelayed) {
        await job.moveToDelayed(delayUntilNextWindow, token || 'token');
        return;
      } else {
        await emailQueue.add('send-email', job.data, {
          delay: delayUntilNextWindow,
          jobId: `email-job-${emailJobId}-shifted-${Date.now()}`,
        });
        return;
      }
    }

    // 4. Minimum Inter-Send Delay Check per sender
    const minDelayRemaining = await RateLimiterService.checkMinDelay(
      senderId,
      config.minDelayBetweenEmailsMs,
      Date.now()
    );

    if (minDelayRemaining > 0) {
      console.log(
        `[Worker] Respecting min delay (${config.minDelayBetweenEmailsMs}ms) for sender ${senderId}. Pausing worker thread for ${minDelayRemaining}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, minDelayRemaining));
    }

    // 5. Send Email via Ethereal SMTP
    try {
      const result = await EtherealService.sendEmail(
        senderId,
        recipientEmail,
        subject,
        body
      );

      const now = new Date();

      // 6. Atomic status update in DB to SENT
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'SENT',
          sentAt: now,
          previewUrl: result.previewUrl || null,
          error: null,
        },
      });

      // 7. Update Redis rate limit counters & timestamp
      await RateLimiterService.incrementHourlyCount(senderId, now);
      await RateLimiterService.updateLastSentTime(senderId, Date.now());

      console.log(
        `[Worker] Successfully sent email to ${recipientEmail}. Preview: ${result.previewUrl}`
      );
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown error occurred while sending email';
      console.error(`[Worker] Error sending email to ${recipientEmail}:`, errorMessage);

      // Update DB status to FAILED
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'FAILED',
          error: errorMessage,
        },
      });

      throw err;
    }
  };

  // Register with resilient processor
  registerWorkerProcessor(processor);

  if (process.env.USE_REAL_REDIS === 'true') {
    try {
      const worker = new Worker<EmailJobPayload>(EMAIL_QUEUE_NAME, processor as any, {
        connection: redisConnection,
        concurrency: config.workerConcurrency,
      });

      worker.on('completed', (job) => {
        console.log(`[Worker] Job ${job.id} completed successfully.`);
      });

      worker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
      });

      return worker;
    } catch (e) {
      console.warn('[Worker] Running in zero-Docker in-memory worker mode.');
    }
  }

  console.log('[Worker] Worker registered in zero-Docker standalone mode.');
  return null;
}
