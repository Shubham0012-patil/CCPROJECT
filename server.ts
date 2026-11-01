import express from 'express';
import path from 'path';
import cloudRouter from './server/cloudRoutes';

async function createServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // JSON and URL-encoded body parsers (with 60mb limits for financial reports/documents)
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  // Security headers & CORS
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Mount Cloud Storage API endpoints
  app.use('/api/cloud', cloudRouter);

  // General Health Check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'NEXMONEY Full-Stack Cloud Server',
      timestamp: new Date().toISOString(),
    });
  });

  // Vite development vs production static middleware
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[NEXMONEY] Server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('[NEXMONEY] Failed to start server:', err);
  process.exit(1);
});
