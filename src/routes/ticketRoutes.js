import express from 'express';
import {
  createTicket,
  getTickets,
  getTicketStats,
  resolveTicket,
  lockTicket,
  unlockTicket,
  assignTicket,
  getTicketMessages,
  createTicketMessage
} from '../controllers/ticketController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Stats (must be before /:ticketId routes to avoid conflict) ──
router.get('/stats', protect, authorize('Admin'), getTicketStats);

// ── Ticket Queue ───────────────────────────────────────────────
router.post('/create', createTicket);
router.get('/', protect, getTickets);

// ── Single Ticket Actions ──────────────────────────────────────
router.patch('/:ticketId/resolve', protect, resolveTicket);
router.patch('/:ticketId/lock', protect, lockTicket);
router.patch('/:ticketId/unlock', protect, unlockTicket);
router.patch('/:ticketId/assign', protect, authorize('Admin'), assignTicket);

// ── Messages ───────────────────────────────────────────────────
router.get('/:ticketId/messages', protect, getTicketMessages);
router.post('/:ticketId/messages', protect, createTicketMessage);

export default router;
