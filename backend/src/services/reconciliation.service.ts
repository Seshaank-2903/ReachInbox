import { prisma } from '../db/prisma';
import { emailQueue, EmailJobPayload } from '../queues/email.queue';

export class ReconciliationService {
  /**
   * Scans the database for PENDING EmailJobs and verifies if they exist in BullMQ.
   * If missing or orphaned, re-enqueues them with remaining delay max(scheduledTime - now, 0).
   */
  static async reconcilePendingJobs(): Promise<{ checked: number; reEnqueued: number }> {
    console.log('[Reconciliation] Starting boot check for pending email jobs...');

    const pendingJobs = await prisma.emailJob.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        campaign: true,
      },
    });

    if (pendingJobs.length === 0) {
      console.log('[Reconciliation] No PENDING email jobs found in database.');
      return { checked: 0, reEnqueued: 0 };
    }

    let reEnqueuedCount = 0;
    const nowMs = Date.now();

    for (const emailJob of pendingJobs) {
      const expectedJobId = `email-job-${emailJob.id}`;
      let existingJob = null;

      try {
        existingJob = await emailQueue.getJob(expectedJobId);
      } catch (err) {
        console.warn(`[Reconciliation] Could not fetch job ${expectedJobId} from BullMQ:`, err);
      }

      // If job does not exist in BullMQ or was removed/flushed, re-enqueue
      if (!existingJob) {
        const scheduledMs = new Date(emailJob.scheduledTime).getTime();
        const remainingDelay = Math.max(0, scheduledMs - nowMs);

        console.log(
          `[Reconciliation] Re-enqueuing orphan job ${emailJob.id} for recipient ${emailJob.recipientEmail} with delay ${remainingDelay}ms`
        );

        const payload: EmailJobPayload = {
          emailJobId: emailJob.id,
          senderId: emailJob.senderId,
          recipientEmail: emailJob.recipientEmail,
          subject: emailJob.campaign.subject,
          body: emailJob.campaign.body,
          scheduledTime: new Date(emailJob.scheduledTime).toISOString(),
        };

        const bullJob = await emailQueue.add('send-email', payload, {
          delay: remainingDelay,
          jobId: expectedJobId,
        });

        await prisma.emailJob.update({
          where: { id: emailJob.id },
          data: { bullJobId: bullJob.id },
        });

        reEnqueuedCount++;
      }
    }

    console.log(
      `[Reconciliation] Completed. Checked ${pendingJobs.length} PENDING jobs, re-enqueued ${reEnqueuedCount} missing jobs.`
    );

    return {
      checked: pendingJobs.length,
      reEnqueued: reEnqueuedCount,
    };
  }
}
