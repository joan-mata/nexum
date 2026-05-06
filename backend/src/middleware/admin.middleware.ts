import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Autenticación requerida' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Acceso de administrador requerido' });
    return;
  }

  next();
}
