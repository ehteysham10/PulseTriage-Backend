import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    select: false // Never returned in queries by default
  },
  role: {
    type: String,
    enum: ['Admin', 'Agent'],
    default: 'Agent',
    required: true
  },
  approvalStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  isSuperAdmin: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Auto-hash password before saving if it has been modified
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare a candidate password with the hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
