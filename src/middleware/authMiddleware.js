import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Protect middleware: Verifies the JWT token from the Authorization header.
 * Attaches the authenticated user to req.user.
 */
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'pulsetriage_super_secret_jwt_key_2024';
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized. Invalid or expired token.' });
  }
};

/**
 * Authorize middleware: Restricts access to specific roles.
 * Must be used AFTER protect middleware.
 * Usage: authorize('Admin') or authorize('Admin', 'Agent')
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }
    next();
  };
};

/**
 * isSuperAdmin middleware: Restricts access to ONLY the Super Admin.
 * Must be used AFTER protect middleware.
 */
export const isSuperAdmin = (req, res, next) => {
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({
      message: 'Access denied. Only the Super Admin can perform this action.'
    });
  }
  next();
};
