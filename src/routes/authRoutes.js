import express from 'express';
import {
  register,
  login,
  getPendingAgents,
  getAllAgents,
  approveAgent,
  rejectAgent,
  promoteToAdmin,
  demoteToAgent
} from '../controllers/authController.js';
import { protect, authorize, isSuperAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Public Routes ──────────────────────────────
router.post('/register', register);
router.post('/login', login);

// ── Admin Routes ───────────────────────────────
router.get('/pending', protect, authorize('Admin'), getPendingAgents);
router.get('/agents', protect, authorize('Admin'), getAllAgents);
router.patch('/approve/:userId', protect, authorize('Admin'), approveAgent);
router.patch('/reject/:userId', protect, authorize('Admin'), rejectAgent);

// ── Super Admin Only Routes ────────────────────
router.patch('/promote/:userId', protect, isSuperAdmin, promoteToAdmin);
router.patch('/demote/:userId', protect, isSuperAdmin, demoteToAgent);

export default router;
