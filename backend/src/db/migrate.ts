import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import pool from './pool';

async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = file.replace('.sql', '');
      const { rows } = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (rows.length === 0) {
        console.log(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        console.log(`Migration ${file} applied successfully`);
      }
    }

    console.log('Migrations completed successfully');
  } finally {
    client.release();
  }
}

async function seedAdminUser(): Promise<void> {
  const adminUsername = process.env['ADMIN_USERNAME'];
  const adminPassword = process.env['ADMIN_PASSWORD'];

  if (!adminUsername || !adminPassword) {
    console.warn('ADMIN_USERNAME or ADMIN_PASSWORD not set, skipping admin seed');
    return;
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = true LIMIT 1"
    );

    if (rows.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 14);
      await client.query(
        `INSERT INTO users (username, email, password_hash, role, must_change_password)
         VALUES ($1, $2, $3, 'admin', true)`,
        [adminUsername, `${adminUsername}@nexum.local`, passwordHash]
      );
      console.log('Admin user created. Please change the password after first login.');
    }
  } finally {
    client.release();
  }
}

export async function initializeDatabase(): Promise<void> {
  await runMigrations();
  await seedAdminUser();
}
