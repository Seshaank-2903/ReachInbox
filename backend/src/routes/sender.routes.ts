import { Router } from 'express';
import { SenderController } from '../controllers/sender.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', SenderController.getSenders as any);
router.post('/', SenderController.createSender as any);

export default router;
