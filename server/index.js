import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { bus } from './bus.js';
import { startServices } from './services.js';
import { sweepOutbox, HttpError } from './store.js';
import { api } from './api.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '..', 'public');

async function boot() {
  await startServices();

  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' });
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', api);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(express.static(pub, { extensions: ['html'] }));
  // Single page app: any other path loads the shell and the client router takes over.
  app.use((_req, res) => res.sendFile(path.join(pub, 'index.html')));

  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  setInterval(() => sweepOutbox().catch((e) => console.error('outbox', e.message)), 8000).unref();

  const server = app.listen(config.port, () => {
    console.log(`\nHaat is open at http://localhost:${config.port}\n`);
  });

  const stop = async () => {
    server.close();
    await bus.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

boot().catch((err) => {
  console.error('\nCould not start:', err.message);
  process.exit(1);
});
