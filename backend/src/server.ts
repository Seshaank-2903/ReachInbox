import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { config } from './config';
import routes from './routes';
import { EtherealService } from './services/ethereal.service';
import { ReconciliationService } from './services/reconciliation.service';

const app = express();

app.use(
  cors({
    origin: [config.frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(passport.initialize());

let isInitialized = false;
async function initServer() {
  if (!isInitialized) {
    try {
      await EtherealService.bootstrapDefaultSender();
      await ReconciliationService.reconcilePendingJobs();
      isInitialized = true;
    } catch (e) {
      console.warn('[Server Bootstrap] Warning during startup initialization:', e);
    }
  }
}

// Request initialization guard for Vercel & Express
app.use(async (req, res, next) => {
  await initServer();
  next();
});

// Mount API & Auth routes
app.use('/', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Server execution entrypoint
const listenPort = process.env.PORT ? parseInt(process.env.PORT, 10) : config.port;

app.listen(listenPort, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`[API Server] ReachInbox Backend running on port ${listenPort}`);
  console.log(`[API Server] Frontend URL configured as: ${config.frontendUrl}`);
  console.log('====================================================');
});

export default app;
