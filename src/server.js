import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import setupSocket from './socket/socketHandler.js';
import { startSlaWorker } from './queues/slaWorker.js';
import seedSuperAdmin from './utils/seedSuperAdmin.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load env vars
dotenv.config();

// ── Crash Protection ────────────────────────────────────────────────────────
// Prevent uncaught exceptions from crashing the server silently
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION — shutting down gracefully...');
  console.error(err.name, err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED PROMISE REJECTION:', err.message);
  // Don't exit — just log it so the server keeps running
});
// ───────────────────────────────────────────────────────────────────────────

// Connect to Database, then seed Super Admin
connectDB().then(() => seedSuperAdmin());

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://pulse-triage-blond.vercel.app'
];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
  }
});

// Attach socket.io to the app so controllers can use it
app.set('io', io);

// Initialize socket handlers
setupSocket(io);

// Initialize SLA worker
startSlaWorker();

// ── Core Middleware ─────────────────────────────────────────────────────────
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Handle malformed JSON body
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON in request body.' });
  }
  next(err);
});
// ───────────────────────────────────────────────────────────────────────────

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'PulseTriage API is running.' });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found.` });
});
// ───────────────────────────────────────────────────────────────────────────

// ── Global Error Handler (must be last) ────────────────────────────────────
app.use(errorHandler);
// ───────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown on SIGTERM (e.g. from Render/Heroku)
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
