import { Request, Response } from 'express';
import { z } from 'zod';
import { UsersService, getClientIp } from '../services/users.service';

const acceptInviteSchema = z.object({
  invite_token: z.string().min(1),
  password: z
    .string()
    .min(10)
    .regex(/[A-Z]/, 'Debe contener una mayúscula')
    .regex(/[a-z]/, 'Debe contener una minúscula')
    .regex(/[0-9]/, 'Debe contener un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener un símbolo'),
});

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  role: z.enum(['admin', 'operator']),
  password: z
    .string()
    .min(10)
    .regex(/[A-Z]/, 'Debe contener una mayúscula')
    .regex(/[a-z]/, 'Debe contener una minúscula')
    .regex(/[0-9]/, 'Debe contener un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener un símbolo'),
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
    .min(10)
    .regex(/[A-Z]/, 'Debe contener una mayúscula')
    .regex(/[a-z]/, 'Debe contener una minúscula')
    .regex(/[0-9]/, 'Debe contener un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener un símbolo'),
});

export const UsersController = {
  create: async (req: Request, res: Response): Promise<void> => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const { username, email, role, password } = parsed.data;
    const result = await UsersService.create(
      req.user!.userId,
      username,
      email,
      role,
      password,
      getClientIp(req),
      req.headers['user-agent']
    );

    if (!result.success) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(201).json({ user: result.user });
  },

  acceptInvite: async (req: Request, res: Response): Promise<void> => {
    const parsed = acceptInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
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
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
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
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
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

    res.json({ message: 'Contraseña cambiada correctamente' });
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
      message: `Usuario ${result.is_active ? 'activado' : 'desactivado'} correctamente`,
      is_active: result.is_active,
    });
  },

  getAuditLog: async (_req: Request, res: Response): Promise<void> => {
    const rows = await UsersService.getAuditLog();
    res.json(rows);
  },
};
