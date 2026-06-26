import Ticket from '../models/Ticket.js';
import Message from '../models/Message.js';
import { triageIncomingTicket } from '../utils/geminiTriage.js';
import { addSlaJob } from '../queues/slaQueue.js';

// ─────────────────────────────────────────────
// POST /api/tickets/create
// Creates a new ticket, AI-triages it, and notifies agents via Socket.io
// ─────────────────────────────────────────────
export const createTicket = async (req, res) => {
  try {
    const { title, description, customerId } = req.body;

    if (!title || !description || !customerId) {
      return res.status(400).json({ message: 'Title, description, and customerId are required' });
    }

    const aiClassification = await triageIncomingTicket(description);

    const newTicket = await Ticket.create({
      title,
      description,
      customerId,
      status: 'Open',
      priority: aiClassification.priority || 'Low',
      tags: aiClassification.tags || [],
    });

    await Message.create({
      ticketId: newTicket._id,
      senderType: 'Customer',
      senderId: customerId,
      content: description
    });

    const io = req.app.get('io');
    if (io) {
      io.to('agents').emit('ticket:created', newTicket);
    }

    if (newTicket.priority === 'High') {
      await addSlaJob(newTicket._id, 30000);
    }

    res.status(201).json({
      message: 'Ticket created and triaged successfully',
      aiClassification,
      ticket: newTicket
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// GET /api/tickets
// Cursor-based pagination + filtering + full-text search
// Query params: cursor, limit, status, priority, tags, search
// ─────────────────────────────────────────────
export const getTickets = async (req, res) => {
  try {
    const { cursor, limit = 20, status, priority, tags, search } = req.query;
    const pageLimit = Math.min(parseInt(limit), 100); // Cap at 100

    const query = {};

    // Cursor-based pagination: fetch tickets older than the given cursor _id
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // Filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (tags) query.tags = { $in: tags.split(',').map(t => t.trim()) };

    // Full-text search (uses the { title: 'text', description: 'text' } index)
    if (search) {
      query.$text = { $search: search };
    }

    const tickets = await Ticket.find(query)
      .sort({ _id: -1 })
      .limit(pageLimit + 1) // Fetch one extra to determine if there are more pages
      .populate('lockedBy', 'name username')
      .populate('assignedTo', 'name username');

    const hasMore = tickets.length > pageLimit;
    if (hasMore) tickets.pop(); // Remove the extra document

    const nextCursor = hasMore ? tickets[tickets.length - 1]._id : null;

    res.json({
      tickets,
      nextCursor,
      hasMore
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ message: 'Failed to fetch tickets' });
  }
};

// ─────────────────────────────────────────────
// GET /api/tickets/stats
// Admin only — Aggregated stats for the dashboard
// ─────────────────────────────────────────────
export const getTicketStats = async (req, res) => {
  try {
    const [statusStats, priorityStats, avgResolutionRaw] = await Promise.all([
      // Count by status
      Ticket.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      // Count by priority
      Ticket.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      // Average resolution time for Resolved tickets (in hours)
      Ticket.aggregate([
        { $match: { status: 'Resolved' } },
        {
          $project: {
            resolutionTimeMs: { $subtract: ['$updatedAt', '$createdAt'] }
          }
        },
        {
          $group: {
            _id: null,
            avgResolutionTimeMs: { $avg: '$resolutionTimeMs' }
          }
        }
      ])
    ]);

    const byStatus = Object.fromEntries(statusStats.map(s => [s._id, s.count]));
    const byPriority = Object.fromEntries(priorityStats.map(p => [p._id, p.count]));
    const avgResolutionHours = avgResolutionRaw[0]
      ? (avgResolutionRaw[0].avgResolutionTimeMs / 3600000).toFixed(2)
      : null;

    res.json({
      byStatus: {
        Open: byStatus.Open || 0,
        'In-Progress': byStatus['In-Progress'] || 0,
        Resolved: byStatus.Resolved || 0
      },
      byPriority: {
        Low: byPriority.Low || 0,
        Medium: byPriority.Medium || 0,
        High: byPriority.High || 0
      },
      avgResolutionHours: avgResolutionHours ? Number(avgResolutionHours) : null
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/tickets/:ticketId/resolve
// Resolves a ticket and clears any lock on it
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// PATCH /api/tickets/:ticketId/lock
// Locks a ticket to the requesting agent. Fails if already locked by another agent.
// ─────────────────────────────────────────────
export const lockTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    // If already locked by a different agent, reject
    if (ticket.lockedBy && ticket.lockedBy.toString() !== req.user._id.toString()) {
      return res.status(409).json({ message: 'Ticket is already locked by another agent.' });
    }

    ticket.lockedBy = req.user._id;
    ticket.lockedAt = new Date();
    await ticket.save();

    const io = req.app.get('io');
    if (io) {
      io.to('agents').emit('ticket:locked', {
        ticketId,
        lockedBy: { _id: req.user._id, name: req.user.name, username: req.user.username }
      });
    }

    res.json({ message: 'Ticket locked successfully.', ticket });
  } catch (error) {
    console.error('Error locking ticket:', error);
    res.status(500).json({ message: 'Failed to lock ticket.' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/tickets/:ticketId/unlock
// Unlocks a ticket. Only the locking agent or an Admin can unlock.
// ─────────────────────────────────────────────
export const unlockTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    const isOwner = ticket.lockedBy && ticket.lockedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'Admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You are not authorized to unlock this ticket.' });
    }

    ticket.lockedBy = null;
    ticket.lockedAt = null;
    await ticket.save();

    const io = req.app.get('io');
    if (io) {
      io.to('agents').emit('ticket:unlocked', { ticketId });
    }

    res.json({ message: 'Ticket unlocked successfully.', ticket });
  } catch (error) {
    console.error('Error unlocking ticket:', error);
    res.status(500).json({ message: 'Failed to unlock ticket.' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/tickets/:ticketId/assign
// Admin only — Assigns a ticket to a specific agent
// ─────────────────────────────────────────────
export const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { agentId } = req.body;

    if (!agentId) return res.status(400).json({ message: 'agentId is required.' });

    const ticket = await Ticket.findByIdAndUpdate(
      ticketId,
      { assignedTo: agentId, status: 'In-Progress' },
      { new: true }
    ).populate('assignedTo', 'name username');

    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

    const io = req.app.get('io');
    if (io) {
      io.to('agents').emit('ticket:assigned', {
        ticketId,
        assignedTo: ticket.assignedTo
      });
    }

    res.json({ message: 'Ticket assigned successfully.', ticket });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({ message: 'Failed to assign ticket.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/tickets/:ticketId/messages
// Returns all messages for a ticket
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// POST /api/tickets/:ticketId/messages
// Sends a message on a ticket and notifies agents via Socket.io
// ─────────────────────────────────────────────
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
