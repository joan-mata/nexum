import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request } from 'express';
import pool from '../db/pool';
import { JwtPayload } from '../types';

export function generateAccessToken(payload: JwtPayload): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first?.trim() ?? req.socket.remoteAddress ?? '';
  }
  return req.socket.remoteAddress ?? '';
}

export const AuthService = {
  login: async (
    username: string,
    password: string,
    ip: string,
    userAgent: string | undefined
  ): Promise<
    | { success: false; status: 401 | 429; body: Record<string, unknown> }
    | {
        success: true;
        accessToken: string;
        refreshToken: string;
        expiresAt: Date;
        user: { id: string; username: string; email: string; role: string; must_change_password: boolean };
      }
  > => {
    const client = await pool.connect();
    try {
      const { rows } = await client.query('SELECT * FROM users WHERE username = $1', [username]);
      const user = rows[0];
      const genericError = 'Invalid credentials';

      if (!user || !user.is_active) {
        return { success: false, status: 401, body: { error: genericError } };
      }

      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const remainingMs = new Date(user.locked_until).getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        return {
          success: false,
          status: 429,
          body: {
            error: `Account temporarily locked. Try again in ${remainingMin} minutes.`,
            locked_until: user.locked_until,
          },
        };
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatch) {
        const newAttempts = (user.failed_login_attempts ?? 0) + 1;
        const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;

        await client.query(
          'UPDATE users SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW() WHERE id = $3',
          [newAttempts, lockUntil, user.id]
        );

        await client.query(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, user_agent)
           VALUES ($1, 'login_failed', 'user', $2, $3, $4)`,
          [user.id, user.id, ip, userAgent ?? null]
        );

        return { success: false, status: 401, body: { error: genericError } };
      }

      await client.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW(), updated_at = NOW() WHERE id = $1',
        [user.id]
      );

      const jwtPayload: JwtPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
      };

      const accessToken = generateAccessToken(jwtPayload);
      const refreshToken = generateRefreshToken();
      const refreshTokenHash = hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await client.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, refreshTokenHash, expiresAt]
      );

      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, user_agent)
         VALUES ($1, 'login_success', 'user', $2, $3, $4)`,
        [user.id, user.id, ip, userAgent ?? null]
      );

      return {
        success: true,
        accessToken,
        refreshToken,
        expiresAt,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          must_change_password: user.must_change_password,
        },
      };
    } finally {
      client.release();
    }
  },

  refresh: async (
    refreshToken: string
  ): Promise<
    | { success: false; status: 401; body: Record<string, unknown> }
    | { success: true; accessToken: string; newRefreshToken: string; expiresAt: Date }
  > => {
    const tokenHash = hashToken(refreshToken);
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT rt.*, u.username, u.role, u.is_active
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = $1`,
        [tokenHash]
      );

      const tokenRecord = rows[0];

      if (!tokenRecord) {
        return { success: false, status: 401, body: { error: 'Invalid refresh token' } };
      }

      if (tokenRecord.revoked_at || tokenRecord.used_at) {
        await client.query(
          'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
          [tokenRecord.user_id]
        );
        return { success: false, status: 401, body: { error: 'Token already used. Please log in again.' } };
      }

      if (new Date(tokenRecord.expires_at) < new Date()) {
        return { success: false, status: 401, body: { error: 'Refresh token expired' } };
      }

      if (!tokenRecord.is_active) {
        return { success: false, status: 401, body: { error: 'User account is disabled' } };
      }

      await client.query('UPDATE refresh_tokens SET used_at = NOW() WHERE id = $1', [tokenRecord.id]);

      const jwtPayload: JwtPayload = {
        userId: tokenRecord.user_id,
        username: tokenRecord.username,
        role: tokenRecord.role,
      };

      const accessToken = generateAccessToken(jwtPayload);
      const newRefreshToken = generateRefreshToken();
      const newRefreshTokenHash = hashToken(newRefreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await client.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [tokenRecord.user_id, newRefreshTokenHash, expiresAt]
      );

      return { success: true, accessToken, newRefreshToken, expiresAt };
    } finally {
      client.release();
    }
  },

  logout: async (refreshToken: string | undefined): Promise<void> => {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );
    }
  },

  logoutAll: async (userId: string): Promise<void> => {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  },
};
