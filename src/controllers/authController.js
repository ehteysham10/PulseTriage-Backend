import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Helper to generate a 7-day JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ─────────────────────────────────────────────
// POST /api/auth/register
// Public — Anyone can register. Role defaults to 'Agent', status to 'Pending'.
// ─────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { username, name, email, password } = req.body;

    if (!username || !name || !email || !password) {
      return res.status(400).json({ message: 'username, name, email, and password are required.' });
    }

    // Password rules: min 8 chars, at least 1 letter, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include at least 1 letter, 1 number, and 1 special character (e.g. !@#$%).'
      });
    }

    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existingUser) {
      return res.status(409).json({ message: 'Email or username is already in use.' });
    }

    await User.create({
      username,
      name,
      email,
      password, // hashed by pre-save hook
      role: 'Agent',
      approvalStatus: 'Pending'
    });

    res.status(201).json({
      message: 'Registration successful. Please wait for admin approval before logging in.'
    });
  } catch (error) {
    console.error('[register]', error.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/login
// Public — Returns a 7-day JWT if credentials are valid and account is approved.
// ─────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Include password field (excluded by default via select: false)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.approvalStatus === 'Pending') {
      return res.status(403).json({
        message: 'Your account is awaiting admin approval. Please check back later.'
      });
    }

    if (user.approvalStatus === 'Rejected') {
      return res.status(403).json({
        message: 'Your registration has been rejected. Please contact the administrator.'
      });
    }

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful.',
      token,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin
      }
    });
  } catch (error) {
    console.error('[login]', error.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/auth/pending
// Admin only — Returns all agents awaiting approval.
// ─────────────────────────────────────────────
export const getPendingAgents = async (req, res) => {
  try {
    const pending = await User.find({ approvalStatus: 'Pending', role: 'Agent' })
      .select('username name email createdAt');
    res.json({ count: pending.length, agents: pending });
  } catch (error) {
    console.error('[getPendingAgents]', error.message);
    res.status(500).json({ message: 'Failed to fetch pending agents.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/auth/agents
// Admin only — Returns all agents with their approval status.
// ─────────────────────────────────────────────
export const getAllAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: 'Agent' })
      .select('username name email approvalStatus createdAt');
    res.json({ count: agents.length, agents });
  } catch (error) {
    console.error('[getAllAgents]', error.message);
    res.status(500).json({ message: 'Failed to fetch agents.' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/auth/approve/:userId
// Admin only — Approves a pending agent.
// Uses findByIdAndUpdate to avoid triggering pre-save hook on unloaded password field.
// ─────────────────────────────────────────────
export const approveAgent = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name role approvalStatus');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role !== 'Agent') return res.status(400).json({ message: 'Only agents can be approved.' });
    if (user.approvalStatus === 'Approved') return res.status(400).json({ message: 'Agent is already approved.' });

    await User.findByIdAndUpdate(req.params.userId, { approvalStatus: 'Approved' });

    res.json({ message: `Agent "${user.name}" has been approved. They can now log in.` });
  } catch (error) {
    console.error('[approveAgent]', error.message);
    res.status(500).json({ message: 'Failed to approve agent.' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/auth/reject/:userId
// Admin only — Rejects a pending agent.
// ─────────────────────────────────────────────
export const rejectAgent = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name role approvalStatus');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role !== 'Agent') return res.status(400).json({ message: 'Only agents can be rejected.' });
    if (user.approvalStatus === 'Rejected') return res.status(400).json({ message: 'Agent is already rejected.' });

    await User.findByIdAndUpdate(req.params.userId, { approvalStatus: 'Rejected' });

    res.json({ message: `Agent "${user.name}" has been rejected.` });
  } catch (error) {
    console.error('[rejectAgent]', error.message);
    res.status(500).json({ message: 'Failed to reject agent.' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/auth/promote/:userId
// Super Admin only — Promotes an Agent to Admin role.
// ─────────────────────────────────────────────
export const promoteToAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name role isSuperAdmin approvalStatus');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.isSuperAdmin) return res.status(400).json({ message: 'Cannot modify the Super Admin.' });
    if (user.role === 'Admin') return res.status(400).json({ message: 'User is already an Admin.' });

    await User.findByIdAndUpdate(req.params.userId, { role: 'Admin', approvalStatus: 'Approved' });

    res.json({ message: `"${user.name}" has been promoted to Admin.` });
  } catch (error) {
    console.error('[promoteToAdmin]', error.message);
    res.status(500).json({ message: 'Failed to promote user.' });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/auth/demote/:userId
// Super Admin only — Demotes an Admin back to Agent role.
// ─────────────────────────────────────────────
export const demoteToAgent = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name role isSuperAdmin');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.isSuperAdmin) return res.status(400).json({ message: 'Cannot demote the Super Admin.' });
    if (user.role === 'Agent') return res.status(400).json({ message: 'User is already an Agent.' });

    await User.findByIdAndUpdate(req.params.userId, { role: 'Agent' });

    res.json({ message: `"${user.name}" has been demoted to Agent.` });
  } catch (error) {
    console.error('[demoteToAgent]', error.message);
    res.status(500).json({ message: 'Failed to demote user.' });
  }
};
