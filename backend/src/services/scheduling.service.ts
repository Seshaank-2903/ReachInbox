import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { emailQueue, EmailJobPayload } from '../queues/email.queue';
import { EtherealService } from './ethereal.service';

export interface ScheduleCampaignInput {
  userId: string;
  senderId?: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string | Date;
  delayBetweenEmailsMs?: number;
  maxEmailsPerHour?: number;
}

export class SchedulingService {
  /**
   * Generates a unique SHA-256 idempotency key for an email job.
   */
  public static generateIdempotencyKey(
    senderId: string,
    recipientEmail: string,
    campaignId: string,
    scheduledTimeMs: number
  ): string {
    const raw = `${senderId.trim()}:${recipientEmail.trim().toLowerCase()}:${campaignId.trim()}:${scheduledTimeMs}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Creates a Campaign and schedules individual recipient EmailJobs into Postgres + BullMQ.
   */
  static async scheduleCampaign(input: ScheduleCampaignInput) {
    const { userId, subject, body, recipients, startTime, delayBetweenEmailsMs = 0 } = input;

    if (!recipients || recipients.length === 0) {
      throw new Error('At least one recipient email address is required.');
    }

    // Default to first sender if not specified
    let senderId = input.senderId;
    if (!senderId) {
      const defaultSender = await EtherealService.bootstrapDefaultSender();
      senderId = defaultSender.id;
    }

    // Parse base start time
    const baseStartTime = startTime ? new Date(startTime) : new Date();
    const baseTimeMs = baseStartTime.getTime();
    const nowMs = Date.now();

    // 1. Create Campaign in DB
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        subject,
        body,
      },
    });

    const createdJobs = [];

    // 2. Loop over recipients, stagger schedule, build idempotency keys, write DB & BullMQ
    for (let i = 0; i < recipients.length; i++) {
      const recipientEmail = recipients[i].trim().toLowerCase();
      if (!recipientEmail) continue;

      // Stagger execution per recipient if delayBetweenEmailsMs provided
      const targetScheduledMs = baseTimeMs + i * delayBetweenEmailsMs;
      const targetScheduledDate = new Date(targetScheduledMs);
      const initialDelay = Math.max(0, targetScheduledMs - nowMs);

      const idempotencyKey = this.generateIdempotencyKey(
        senderId,
        recipientEmail,
        campaign.id,
        targetScheduledMs
      );

      // Check existing job by idempotency key (upsert guard)
      let emailJob = await prisma.emailJob.findUnique({
        where: { idempotencyKey },
      });

      if (!emailJob) {
        emailJob = await prisma.emailJob.create({
          data: {
            campaignId: campaign.id,
            senderId,
            recipientEmail,
            scheduledTime: targetScheduledDate,
            status: 'PENDING',
            idempotencyKey,
          },
        });
      } else if (emailJob.status !== 'PENDING') {
        // If already processed, skip enqueuing
        createdJobs.push(emailJob);
        continue;
      }

      // Enqueue job as BullMQ delayed job
      const payload: EmailJobPayload = {
        emailJobId: emailJob.id,
        senderId,
        recipientEmail,
        subject,
        body,
        scheduledTime: targetScheduledDate.toISOString(),
      };

      const jobOptions = {
        delay: initialDelay,
        jobId: `email-job-${emailJob.id}`,
      };

      const bullJob = await emailQueue.add('send-email', payload, jobOptions);

      // Save bullJobId back to DB row
      const updatedJob = await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId: bullJob.id },
      });

      createdJobs.push(updatedJob);
    }

    return {
      campaign,
      totalScheduled: createdJobs.length,
      jobs: createdJobs,
    };
  }
}
