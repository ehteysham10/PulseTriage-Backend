import express from 'express';
import { createTicket } from '../controllers/ticketController.js';

const router = express.Router();

router.post('/create', createTicket);

export default router;
