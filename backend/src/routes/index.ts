import { Router } from 'express';
import authRoutes from './auth.routes';
import emailRoutes from './email.routes';
import senderRoutes from './sender.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/api/emails', emailRoutes);
router.use('/api/senders', senderRoutes);

export default router;
