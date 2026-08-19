import { Response } from 'express';
import { z } from 'zod';
import { parse } from 'csv-parse/sync';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../db/prisma';
import { SchedulingService } from '../services/scheduling.service';

const scheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.union([z.array(z.string().email()), z.string()]),
  senderId: z.string().optional(),
  startTime: z.string().optional(),
  delayBetweenEmailsMs: z.coerce.number().optional().default(0),
  maxEmailsPerHour: z.coerce.number().optional(),
});

export class EmailController {
  /**
   * Helper to extract clean email array from raw string or array input.
   */
  private static parseRecipients(input: string | string[]): string[] {
    if (Array.isArray(input)) {
      return input.map((e) => e.trim()).filter((e) => e.length > 0);
    }

    if (typeof input === 'string') {
      // Check if CSV formatted
      if (input.includes(',') || input.includes('\n')) {
        try {
          const records = parse(input, {
            skip_empty_lines: true,
            relax_column_count: true,
            trim: true,
          });

          const emails: string[] = [];
          for (const row of records) {
            if (Array.isArray(row)) {
              for (const col of row) {
                if (col && typeof col === 'string' && col.includes('@')) {
                  emails.push(col.trim());
                }
              }
            }
          }
          if (emails.length > 0) return emails;
        } catch (e) {
          // Fallback to split lines/commas
        }
      }

      return input
        .split(/[\n,;\s]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && e.includes('@'));
    }

    return [];
  }

  /**
   * POST /api/emails/schedule
   */
  static async scheduleEmails(req: AuthenticatedRequest, res: Response) {
    try {
      const validated = scheduleEmailSchema.parse(req.body);
      const recipientEmails = EmailController.parseRecipients(validated.recipients);

      if (recipientEmails.length === 0) {
        return res.status(400).json({
          error: 'No valid recipient email addresses found in input.',
        });
      }

      const result = await SchedulingService.scheduleCampaign({
        userId: req.user!.id,
        senderId: validated.senderId,
        subject: validated.subject,
        body: validated.body,
        recipients: recipientEmails,
        startTime: validated.startTime,
        delayBetweenEmailsMs: validated.delayBetweenEmailsMs,
        maxEmailsPerHour: validated.maxEmailsPerHour,
      });

      return res.status(201).json({
        message: `Successfully scheduled campaign with ${result.totalScheduled} emails`,
        campaign: result.campaign,
        totalScheduled: result.totalScheduled,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      console.error('[EmailController] Schedule error:', error);
      return res.status(500).json({ error: error?.message || 'Failed to schedule emails' });
    }
  }

  /**
   * GET /api/emails/scheduled
   */
  static async getScheduledEmails(req: AuthenticatedRequest, res: Response) {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
      const skip = (page - 1) * limit;

      const where = {
        status: 'PENDING' as const,
        campaign: {
          userId: req.user!.id,
        },
      };

      const [total, jobs] = await Promise.all([
        prisma.emailJob.count({ where }),
        prisma.emailJob.findMany({
          where,
          skip,
          take: limit,
          orderBy: { scheduledTime: 'asc' },
          include: {
            campaign: { select: { subject: true, body: true } },
            sender: { select: { name: true, etherealEmail: true } },
          },
        }),
      ]);

      return res.json({
        data: jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error('[EmailController] Error fetching scheduled emails:', error);
      return res.status(500).json({ error: 'Failed to fetch scheduled emails' });
    }
  }

  /**
   * GET /api/emails/sent
   */
  static async getSentEmails(req: AuthenticatedRequest, res: Response) {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
      const statusFilter = req.query.status as string; // 'SENT' | 'FAILED'
      const skip = (page - 1) * limit;

      const statusCondition =
        statusFilter === 'SENT' || statusFilter === 'FAILED'
          ? (statusFilter as 'SENT' | 'FAILED')
          : { in: ['SENT' as const, 'FAILED' as const] };

      const where = {
        status: statusCondition,
        campaign: {
          userId: req.user!.id,
        },
      };

      const [total, jobs] = await Promise.all([
        prisma.emailJob.count({ where }),
        prisma.emailJob.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            campaign: { select: { subject: true, body: true } },
            sender: { select: { name: true, etherealEmail: true } },
          },
        }),
      ]);

      return res.json({
        data: jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error('[EmailController] Error fetching sent emails:', error);
      return res.status(500).json({ error: 'Failed to fetch sent emails' });
    }
  }
}
