import { createApp } from './app';
import { initializeDatabase } from './db/migrate';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

async function start(): Promise<void> {
  try {
    await initializeDatabase();
    const app = createApp();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
