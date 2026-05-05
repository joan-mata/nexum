import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService, getClientIp } from '../services/auth.service';

const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1),
});

export const AuthController = {
  login: async (req: Request, res: Response): Promise<void> => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { username, password } = parsed.data;
    const ip = getClientIp(req);

    const result = await AuthService.login(username, password, ip, req.headers['user-agent']);

    if (!result.success) {
      res.status(result.status).json(result.body);
      return;
    }

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    res.json({
      access_token: result.accessToken,
      user: result.user,
    });
  },

  refresh: async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies['refresh_token'] as string | undefined;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const result = await AuthService.refresh(refreshToken);

    if (!result.success) {
      res.status(result.status).json(result.body);
      return;
    }

    res.cookie('refresh_token', result.newRefreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    res.json({ access_token: result.accessToken });
  },

  logout: async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies['refresh_token'] as string | undefined;
    await AuthService.logout(refreshToken);
    res.clearCookie('refresh_token', { path: '/api/auth' });
    res.json({ message: 'Logged out successfully' });
  },

  logoutAll: async (req: Request, res: Response): Promise<void> => {
    await AuthService.logoutAll(req.user!.userId);
    res.clearCookie('refresh_token', { path: '/api/auth' });
    res.json({ message: 'All sessions logged out successfully' });
  },
};
