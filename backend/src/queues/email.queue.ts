import { Queue } from 'bullmq';
import { redisConnection } from './connection';

export const EMAIL_QUEUE_NAME = 'email-scheduler-queue';

export interface EmailJobPayload {
  emailJobId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledTime: string; // ISO string
}

export type WorkerProcessor = (
  job: { id: string; data: EmailJobPayload; moveToDelayed?: (ms: number, token: string) => Promise<void> },
  token?: string
) => Promise<any>;

let globalProcessor: WorkerProcessor | null = null;

export function registerWorkerProcessor(processor: WorkerProcessor) {
  globalProcessor = processor;
}

export class ResilientEmailQueue {
  private bullQueue: Queue<EmailJobPayload> | null = null;
  private memoryJobs = new Map<
    string,
    { payload: EmailJobPayload; timer: NodeJS.Timeout; scheduledMs: number }
  >();

  constructor() {
    if (process.env.USE_REAL_REDIS === 'true') {
      try {
        this.bullQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
          connection: redisConnection,
        });
      } catch (e) {
        this.bullQueue = null;
      }
    }
  }

  async add(
    name: string,
    payload: EmailJobPayload,
    options: { delay?: number; jobId?: string } = {}
  ) {
    if (this.bullQueue) {
      try {
        return await this.bullQueue.add(name, payload, options);
      } catch (err) {
        // Fallback to in-memory queue
      }
    }

    const jobId = options.jobId || `email-job-${payload.emailJobId}`;
    const delay = options.delay || 0;

    // Clear existing timer if re-enqueued
    if (this.memoryJobs.has(jobId)) {
      clearTimeout(this.memoryJobs.get(jobId)!.timer);
    }

    const scheduleFn = (delayMs: number) => {
      const timer = setTimeout(async () => {
        if (globalProcessor) {
          try {
            await globalProcessor(
              {
                id: jobId,
                data: payload,
                moveToDelayed: async (nextDelayMs: number) => {
                  scheduleFn(nextDelayMs);
                },
              },
              'mem-token'
            );
          } catch (e) {
            console.error(`[Queue] Job ${jobId} failed:`, e);
          }
        }
        this.memoryJobs.delete(jobId);
      }, delayMs);

      this.memoryJobs.set(jobId, {
        payload,
        timer,
        scheduledMs: Date.now() + delayMs,
      });
    };

    scheduleFn(delay);

    return { id: jobId, data: payload };
  }

  async getJob(jobId: string) {
    if (this.bullQueue) {
      try {
        const job = await this.bullQueue.getJob(jobId);
        if (job) return job;
      } catch (e) {}
    }

    const memJob = this.memoryJobs.get(jobId);
    if (memJob) {
      return { id: jobId, data: memJob.payload };
    }
    return null;
  }
}

export const emailQueue = new ResilientEmailQueue();
