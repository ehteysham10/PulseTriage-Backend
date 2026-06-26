import Ticket from '../models/Ticket.js';
import Message from '../models/Message.js';
import { triageIncomingTicket } from '../utils/geminiTriage.js';
import { addSlaJob } from '../queues/slaQueue.js';

export const createTicket = async (req, res) => {
  try {
    const { title, description, customerId } = req.body;

    if (!title || !description || !customerId) {
      return res.status(400).json({ message: 'Title, description, and customerId are required' });
    }

    // Call Gemini to analyze the description and return JSON categorization
    const aiClassification = await triageIncomingTicket(description);

    // Save the ticket in MongoDB
    const newTicket = await Ticket.create({
      title,
      description,
      customerId,
      status: 'Open',
      priority: aiClassification.priority || 'Low',
      tags: aiClassification.tags || [],
    });

    // Create initial message from customer containing their description
    await Message.create({
      ticketId: newTicket._id,
      senderType: 'Customer',
      senderId: customerId,
      content: description
    });

    // Broadcast the new ticket to all connected agents
    const io = req.app.get('io');
    if (io) {
      io.to('agents').emit('ticket:created', newTicket);
    }

    // If it's a High priority ticket, add it to the SLA queue (30 seconds for testing)
    if (newTicket.priority === 'High') {
      await addSlaJob(newTicket._id, 30000);
    }

    res.status(201).json({
      message: 'Ticket created and triaged successfully',
      aiClassification, // Include this in the response so you can see what Gemini returned
      ticket: newTicket
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ message: 'Failed to fetch tickets' });
  }
};

export const resolveTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    ticket.status = 'Resolved';
    ticket.lockedBy = null;
    ticket.lockedAt = null;
    await ticket.save();

    const io = req.app.get('io');
    if (io) {
      io.to('agents').emit('ticket:unlocked', { ticketId });
      io.to('agents').emit('ticket:resolved', { ticketId });
    }

    res.json({ message: 'Ticket resolved successfully', ticket });
  } catch (error) {
    console.error('Error resolving ticket:', error);
    res.status(500).json({ message: 'Failed to resolve ticket' });
  }
};

export const getTicketMessages = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const messages = await Message.find({ ticketId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching ticket messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

export const createTicketMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { senderType, senderId, content } = req.body;

    if (!senderType || !content) {
      return res.status(400).json({ message: 'senderType and content are required' });
    }

    const newMessage = await Message.create({
      ticketId,
      senderType,
      senderId,
      content
    });

    const io = req.app.get('io');
    if (io) {
      io.to('agents').emit('message:created', newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error creating ticket message:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
};
