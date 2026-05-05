import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

// Routes
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import lendersRoutes from './routes/lenders.routes';
import transactionsRoutes from './routes/transactions.routes';
import dashboardRoutes from './routes/dashboard.routes';
import calendarRoutes from './routes/calendar.routes';
import exitAccountsRoutes from './routes/exit-accounts.routes';

export function createApp(): express.Application {
  const app = express();

  // Trust proxy (nginx in front)
  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    })
  );

  // CORS — only allow from configured origin
  const corsOrigin = process.env['CORS_ORIGIN'] ?? 'https://nexum.joanmata.com';
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Cookie parser
  app.use(cookieParser());

  // Body parser
  app.use(express.json({ limit: '1mb' }));

  // General rate limit: 100 req/min per IP
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });

  // Login rate limit: 5 attempts per 15 min, then block 30 min
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    blockDuration: 30 * 60 * 1000,
    message: { error: 'Too many login attempts. Please try again in 30 minutes.' },
  });

  app.use('/api/', generalLimiter);
  app.use('/api/auth/login', loginLimiter);

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/lenders', lendersRoutes);
  app.use('/api/transactions', transactionsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/exit-accounts', exitAccountsRoutes);

  // Health check (no rate limit)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
