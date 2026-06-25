import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  ticketId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ticket', 
    required: true 
  },
  senderType: { 
    type: String, 
    enum: ['Customer', 'Agent', 'AI', 'System'], 
    required: true 
  },
  senderId: { 
    // Can be User ID (if Agent), or Customer ID/Email. Nullable for System/AI.
    type: mongoose.Schema.Types.Mixed 
  },
  content: { 
    type: String, 
    required: true 
  }
}, { timestamps: true });

// --- Indexing Strategy ---

// Optimizes fetching the timeline of messages for a specific ticket
messageSchema.index({ ticketId: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);
