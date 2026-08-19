import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from '../config';
import { prisma } from '../db/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// Configure Passport Google Strategy if credentials exist
if (config.google.clientId && config.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          let user = await prisma.user.findFirst({
            where: {
              OR: [{ googleId: profile.id }, { email }],
            },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email,
                name: profile.displayName || email.split('@')[0],
                avatarUrl: profile.photos?.[0]?.value || null,
              },
            });
          } else if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                googleId: profile.id,
                avatarUrl: profile.photos?.[0]?.value || user.avatarUrl,
              },
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );
}

export class AuthController {
  /**
   * Generates JWT token and sets HTTP-only cookie.
   */
  private static setAuthCookie(res: Response, userId: string) {
    const token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to true in production HTTPS
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return token;
  }

  /**
   * GET /auth/google
   */
  static googleLogin(req: Request, res: Response, next: any) {
    if (!config.google.clientId || !config.google.clientSecret) {
      return res.status(400).json({
        error:
          'Google OAuth client ID/secret are not configured in environment variables. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET or use /auth/dev-login for instant testing.',
      });
    }

    passport.authenticate('google', { scope: ['profile', 'email'], session: false })(
      req,
      res,
      next
    );
  }

  /**
   * GET /auth/google/callback
   */
  static googleCallback(req: Request, res: Response, next: any) {
    passport.authenticate('google', { session: false }, (err: any, user: any) => {
      if (err || !user) {
        console.error('[OAuth] Google callback error:', err);
        return res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
      }

      AuthController.setAuthCookie(res, user.id);
      return res.redirect(`${config.frontendUrl}/dashboard`);
    })(req, res, next);
  }

  /**
   * GET /auth/me
   */
  static async getMe(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    return res.json({
      user: req.user,
    });
  }

  /**
   * POST /auth/logout
   */
  static async logout(req: Request, res: Response) {
    res.clearCookie('token');
    return res.json({ message: 'Successfully logged out' });
  }

  /**
   * POST /auth/dev-login (Out-of-box instant login for reviewers/devs)
   */
  static async devLogin(req: Request, res: Response) {
    const { email = 'demo.user@reachinbox.ai', name = 'ReachInbox Demo User' } = req.body;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox',
        },
      });
    }

    const token = AuthController.setAuthCookie(res, user.id);

    return res.json({
      message: 'Dev login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      token,
    });
  }
}
