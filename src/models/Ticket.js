import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Open', 'In-Progress', 'Resolved'], 
    default: 'Open',
    required: true
  },
  priority: { 
    type: String, 
    enum: ['Low', 'Medium', 'High'], 
    default: 'Low',
    required: true
  },
  tags: [{ 
    type: String, 
    trim: true 
  }],
  lockedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  lockedAt: { 
    type: Date, 
    default: null 
  },
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null
  },
  customerId: { 
    type: String, 
    required: true 
  } // Can be an email or name for testing purposes
}, { timestamps: true });

// --- Indexing Strategy ---

// Compound Index for Status and Priority (optimizes retrieval of tickets by status and priority)
ticketSchema.index({ status: 1, priority: -1 });

// Index for Agent Queues (optimizes finding tickets assigned to or locked by a particular agent)
ticketSchema.index({ lockedBy: 1 });
ticketSchema.index({ assignedTo: 1 });

// Index for tracking lock timeouts efficiently
ticketSchema.index({ lockedAt: 1 }, { partialFilterExpression: { lockedAt: { $type: "date" } } });

export default mongoose.model('Ticket', ticketSchema);
