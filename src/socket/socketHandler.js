import Ticket from '../models/Ticket.js';

export default function setupSocket(io) {
  // Store locked tickets by socket.id to handle cleanups on disconnect
  const socketLocks = new Map();

  io.on('connection', (socket) => {
    console.log(`Agent connected: ${socket.id}`);

    // Agent joins the global agents room
    socket.join('agents');

    socket.on('ticket:lock', async ({ ticketId, agentId }) => {
      try {
        // Find the ticket and make sure it's not already locked
        const ticket = await Ticket.findById(ticketId);
        
        if (!ticket) {
          return socket.emit('error', { message: 'Ticket not found' });
        }

        if (ticket.lockedBy && ticket.lockedBy.toString() !== agentId) {
          return socket.emit('error', { message: 'Ticket is already locked by another agent' });
        }

        // Lock the ticket
        ticket.lockedBy = agentId;
        ticket.lockedAt = new Date();
        await ticket.save();

        // Track the lock for this socket
        if (!socketLocks.has(socket.id)) {
          socketLocks.set(socket.id, new Set());
        }
        socketLocks.get(socket.id).add(ticketId);

        // Broadcast to all agents that this ticket is locked
        io.to('agents').emit('ticket:locked', { ticketId, agentId });
        console.log(`Ticket ${ticketId} locked by agent ${agentId} via socket ${socket.id}`);
      } catch (error) {
        console.error('Error locking ticket:', error);
        socket.emit('error', { message: 'Failed to lock ticket' });
      }
    });

    socket.on('ticket:unlock', async ({ ticketId, agentId }) => {
      try {
        const ticket = await Ticket.findById(ticketId);
        
        if (!ticket) {
          return socket.emit('error', { message: 'Ticket not found' });
        }

        // We only allow unlocking if it's currently locked by this agent
        // (In a real app, an admin might have force-unlock privileges)
        if (ticket.lockedBy && ticket.lockedBy.toString() === agentId) {
          ticket.lockedBy = null;
          ticket.lockedAt = null;
          await ticket.save();

          // Remove from tracking
          if (socketLocks.has(socket.id)) {
            socketLocks.get(socket.id).delete(ticketId);
          }

          io.to('agents').emit('ticket:unlocked', { ticketId });
          console.log(`Ticket ${ticketId} unlocked by agent ${agentId} via socket ${socket.id}`);
        }
      } catch (error) {
        console.error('Error unlocking ticket:', error);
        socket.emit('error', { message: 'Failed to unlock ticket' });
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Agent disconnected: ${socket.id}`);
      
      // Auto-unlock tickets if the agent disconnects
      if (socketLocks.has(socket.id)) {
        const lockedTickets = socketLocks.get(socket.id);
        for (const ticketId of lockedTickets) {
          try {
            const ticket = await Ticket.findById(ticketId);
            if (ticket) {
              ticket.lockedBy = null;
              ticket.lockedAt = null;
              await ticket.save();
              io.to('agents').emit('ticket:unlocked', { ticketId });
              console.log(`Auto-unlocked ticket ${ticketId} due to agent disconnect`);
            }
          } catch (error) {
            console.error(`Error auto-unlocking ticket ${ticketId}:`, error);
          }
        }
        socketLocks.delete(socket.id);
      }
    });
  });
}
