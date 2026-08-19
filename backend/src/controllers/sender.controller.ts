import { Response } from 'express';
import nodemailer from 'nodemailer';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../db/prisma';
import { EtherealService } from '../services/ethereal.service';

export class SenderController {
  /**
   * GET /api/senders
   */
  static async getSenders(req: AuthenticatedRequest, res: Response) {
    try {
      let senders = await prisma.sender.findMany({
        orderBy: { createdAt: 'desc' },
      });

      if (senders.length === 0) {
        const defaultSender = await EtherealService.bootstrapDefaultSender();
        senders = [defaultSender];
      }

      return res.json({ senders });
    } catch (error: any) {
      console.error('[SenderController] Error fetching senders:', error);
      return res.status(500).json({ error: 'Failed to fetch senders' });
    }
  }

  /**
   * POST /api/senders (Create a new test Ethereal sender)
   */
  static async createSender(req: AuthenticatedRequest, res: Response) {
    try {
      const { name } = req.body;
      const testAccount = await nodemailer.createTestAccount();

      const sender = await prisma.sender.create({
        data: {
          name: name || `Sender (${testAccount.user.split('@')[0]})`,
          etherealEmail: testAccount.user,
          etherealPass: testAccount.pass,
        },
      });

      return res.status(201).json({ sender });
    } catch (error: any) {
      console.error('[SenderController] Error creating sender:', error);
      return res.status(500).json({ error: 'Failed to create new Ethereal sender' });
    }
  }
}
