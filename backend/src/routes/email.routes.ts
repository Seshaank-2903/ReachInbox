import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth as any);

router.post('/schedule', EmailController.scheduleEmails as any);
router.get('/scheduled', EmailController.getScheduledEmails as any);
router.get('/sent', EmailController.getSentEmails as any);

export default router;
