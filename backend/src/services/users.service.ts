import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request } from 'express';
import pool from '../db/pool';

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first?.trim() ?? req.socket.remoteAddress ?? '';
  }
  return req.socket.remoteAddress ?? '';
}

async function auditLog(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  ip: string,
  userAgent: string | undefined,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId,
      action,
      entityType,
      entityId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ip,
      userAgent ?? null,
    ]
  );
}

export const UsersService = {
  acceptInvite: async (
    inviteToken: string,
    password: string
  ): Promise<{ success: false; status: 400; error: string } | { success: true }> => {
    const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');

    const { rows } = await pool.query(
      "SELECT * FROM users WHERE password_hash LIKE $1 AND is_active = false",
      [`INVITE:${tokenHash}:%`]
    );

    if (rows.length === 0) {
      return { success: false, status: 400, error: 'Invalid or expired invite token' };
    }

    const user = rows[0];
    const parts = (user.password_hash as string).split(':');
    const expiresAt = new Date(parts[2]);

    if (expiresAt < new Date()) {
      return { success: false, status: 400, error: 'Invite token has expired' };
    }

    const passwordHash = await bcrypt.hash(password, 14);

    await pool.query(
      `UPDATE users SET password_hash = $1, is_active = true, must_change_password = false, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    return { success: true };
  },

  findAll: async () => {
    const { rows } = await pool.query(
      `SELECT id, username, email, role, is_active, must_change_password,
              created_at, updated_at, last_login, failed_login_attempts, locked_until
       FROM users ORDER BY created_at ASC`
    );
    return rows;
  },

  invite: async (
    adminUserId: string,
    username: string,
    email: string,
    role: 'admin' | 'operator',
    ip: string,
    userAgent: string | undefined
  ): Promise<
    | { success: false; status: 400 | 409; error: string }
    | { success: true; inviteToken: string; expiresAt: Date; user: { id: string; username: string; email: string; role: string } }
  > => {
    const { rows: activeCount } = await pool.query(
      'SELECT COUNT(*) FROM users WHERE is_active = true'
    );
    if (parseInt(activeCount[0].count) >= 10) {
      return { success: false, status: 400, error: 'Maximum active users limit (10) reached' };
    }

    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.length > 0) {
      return { success: false, status: 409, error: 'Username or email already exists' };
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO users (username, email, password_hash, role, must_change_password, is_active)
         VALUES ($1, $2, $3, $4, true, false)
         RETURNING id`,
        [username, email, `INVITE:${tokenHash}:${expiresAt.toISOString()}`, role]
      );

      const userId = rows[0].id as string;

      await auditLog(adminUserId, 'user_invited', 'user', userId, ip, userAgent, undefined, { username, email, role });

      await client.query('COMMIT');

      return { success: true, inviteToken, expiresAt, user: { id: userId, username, email, role } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  changePassword: async (
    adminUserId: string,
    targetUserId: string,
    adminPassword: string,
    newPassword: string,
    ip: string,
    userAgent: string | undefined
  ): Promise<{ success: false; status: 400 | 401 | 404; error: string } | { success: true }> => {
    const { rows: adminRows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [adminUserId]
    );

    if (adminRows.length === 0) {
      return { success: false, status: 400, error: 'Admin not found' };
    }

    const adminValid = await bcrypt.compare(adminPassword, adminRows[0].password_hash);
    if (!adminValid) {
      return { success: false, status: 401, error: 'Invalid admin password' };
    }

    const { rows: targetRows } = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [targetUserId]
    );

    if (targetRows.length === 0) {
      return { success: false, status: 404, error: 'User not found' };
    }

    const passwordHash = await bcrypt.hash(newPassword, 14);

    await pool.query(
      `UPDATE users SET password_hash = $1, must_change_password = true, updated_at = NOW() WHERE id = $2`,
      [passwordHash, targetUserId]
    );

    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [targetUserId]
    );

    await auditLog(adminUserId, 'user_password_changed', 'user', targetUserId, ip, userAgent);

    return { success: true };
  },

  toggleActive: async (
    adminUserId: string,
    targetUserId: string,
    ip: string,
    userAgent: string | undefined
  ): Promise<{ success: false; status: 400 | 404; error: string } | { success: true; is_active: boolean }> => {
    if (targetUserId === adminUserId) {
      return { success: false, status: 400, error: 'Cannot deactivate your own account' };
    }

    const { rows } = await pool.query(
      'SELECT id, is_active FROM users WHERE id = $1',
      [targetUserId]
    );

    if (rows.length === 0) {
      return { success: false, status: 404, error: 'User not found' };
    }

    const newState = !rows[0].is_active;

    await pool.query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2',
      [newState, targetUserId]
    );

    if (!newState) {
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
        [targetUserId]
      );
    }

    await auditLog(
      adminUserId,
      newState ? 'user_activated' : 'user_deactivated',
      'user',
      targetUserId,
      ip,
      userAgent,
      { is_active: rows[0].is_active },
      { is_active: newState }
    );

    return { success: true, is_active: newState };
  },

  getAuditLog: async () => {
    const { rows } = await pool.query(
      `SELECT al.*, u.username
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT 50`
    );
    return rows;
  },
};
