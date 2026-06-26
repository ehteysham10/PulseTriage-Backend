import express from 'express';
import { 
  createTicket, 
  getTickets, 
  resolveTicket, 
  getTicketMessages, 
  createTicketMessage 
} from '../controllers/ticketController.js';

const router = express.Router();

router.post('/create', createTicket);
router.get('/', getTickets);
router.patch('/:ticketId/resolve', resolveTicket);
router.get('/:ticketId/messages', getTicketMessages);
router.post('/:ticketId/messages', createTicketMessage);

export default router;
