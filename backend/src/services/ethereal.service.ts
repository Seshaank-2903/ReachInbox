import nodemailer from 'nodemailer';
import { prisma } from '../db/prisma';

const transporterCache = new Map<string, nodemailer.Transporter>();

export class EtherealService {
  /**
   * Ensures at least one default Ethereal test sender exists in the database.
   */
  static async bootstrapDefaultSender() {
    try {
      const existingSenders = await prisma.sender.findMany({ take: 1 });
      if (existingSenders.length > 0) {
        return existingSenders[0];
      }

      console.log('[Ethereal] No senders found in DB. Creating test Ethereal account...');
      const testAccount = await nodemailer.createTestAccount();
      
      const newSender = await prisma.sender.create({
        data: {
          name: `ReachInbox Outreach (${testAccount.user.split('@')[0]})`,
          etherealEmail: testAccount.user,
          etherealPass: testAccount.pass,
        },
      });

      console.log(`[Ethereal] Default sender created: ${newSender.etherealEmail}`);
      return newSender;
    } catch (error) {
      console.error('[Ethereal] Failed to bootstrap default sender:', error);
      throw error;
    }
  }

  /**
   * Creates or retrieves a cached Nodemailer transporter for a given Sender ID.
   */
  static async getTransporter(senderId: string): Promise<nodemailer.Transporter> {
    if (transporterCache.has(senderId)) {
      return transporterCache.get(senderId)!;
    }

    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!sender) {
      throw new Error(`Sender with ID ${senderId} not found in database`);
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: sender.etherealEmail,
        pass: sender.etherealPass,
      },
    });

    transporterCache.set(senderId, transporter);
    return transporter;
  }

  /**
   * Transmits an email via Ethereal SMTP and returns the Nodemailer test preview URL.
   */
  static async sendEmail(
    senderId: string,
    to: string,
    subject: string,
    html: string
  ): Promise<{ messageId: string; previewUrl: string | false }> {
    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!sender) {
      throw new Error(`Sender with ID ${senderId} not found`);
    }

    const transporter = await this.getTransporter(senderId);

    const info = await transporter.sendMail({
      from: `"${sender.name}" <${sender.etherealEmail}>`,
      to,
      subject,
      html,
      text: html.replace(/<[^>]*>?/gm, ''), // fallback plaintext
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[Ethereal] Email sent to ${to}. Preview URL: ${previewUrl}`);

    return {
      messageId: info.messageId,
      previewUrl: previewUrl,
    };
  }
}
