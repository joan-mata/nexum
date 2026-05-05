import { Request, Response } from 'express';
import { z } from 'zod';
import { UsersService, getClientIp } from '../services/users.service';

const acceptInviteSchema = z.object({
  invite_token: z.string().min(1),
  password: z
    .string()
    .min(12)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain symbol'),
});

const inviteSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  role: z.enum(['admin', 'operator']),
});

const changePasswordSchema = z.object({
  admin_password: z.string().min(1),
  new_password: z
    .string()
    .min(12)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain symbol'),
});

export const UsersController = {
  acceptInvite: async (req: Request, res: Response): Promise<void> => {
    const parsed = acceptInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const result = await UsersService.acceptInvite(parsed.data.invite_token, parsed.data.password);

    if (!result.success) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ message: 'Contraseña establecida correctamente. Ya puedes iniciar sesión.' });
  },

  list: async (_req: Request, res: Response): Promise<void> => {
    const users = await UsersService.findAll();
    res.json(users);
  },

  invite: async (req: Request, res: Response): Promise<void> => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { username, email, role } = parsed.data;
    const result = await UsersService.invite(
      req.user!.userId,
      username,
      email,
      role,
      getClientIp(req),
      req.headers['user-agent']
    );

    if (!result.success) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(201).json({
      invite_token: result.inviteToken,
      expires_at: result.expiresAt,
      user: result.user,
    });
  },

  changePassword: async (req: Request, res: Response): Promise<void> => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const result = await UsersService.changePassword(
      req.user!.userId,
      req.params['id']!,
      parsed.data.admin_password,
      parsed.data.new_password,
      getClientIp(req),
      req.headers['user-agent']
    );

    if (!result.success) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ message: 'Password changed successfully' });
  },

  toggleActive: async (req: Request, res: Response): Promise<void> => {
    const result = await UsersService.toggleActive(
      req.user!.userId,
      req.params['id']!,
      getClientIp(req),
      req.headers['user-agent']
    );

    if (!result.success) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({
      message: `User ${result.is_active ? 'activated' : 'deactivated'} successfully`,
      is_active: result.is_active,
    });
  },

  getAuditLog: async (_req: Request, res: Response): Promise<void> => {
    const rows = await UsersService.getAuditLog();
    res.json(rows);
  },
};
