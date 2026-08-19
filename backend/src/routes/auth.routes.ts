import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/google', AuthController.googleLogin);
router.get('/google/callback', AuthController.googleCallback);
router.get('/me', requireAuth as any, AuthController.getMe as any);
router.post('/logout', AuthController.logout);
router.post('/dev-login', AuthController.devLogin);

export default router;
