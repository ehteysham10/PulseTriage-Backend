import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  role: { 
    type: String, 
    enum: ['Admin', 'Agent'], 
    default: 'Agent',
    required: true
  }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
