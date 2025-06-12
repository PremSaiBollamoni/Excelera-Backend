import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    console.log('Registration attempt for:', email);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Invalid email format. Please enter a valid email address.' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({ message: 'User already exists' });
    }

    // Validate password
    if (!password || password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Create new user with pending status
    const user = new User({
      email: email.toLowerCase(), // Store email in lowercase
      password,
      name,
      status: 'pending'
    });

    await user.save();
    console.log('User registered successfully:', email);

    res.status(201).json({ 
      message: 'User created successfully. Please note your login credentials:',
      email: user.email // Return the email they should use to login
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error during registration',
      details: error.message 
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email);

    // Convert email to lowercase for consistency
    const normalizedEmail = email.toLowerCase();

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.log('User not found with email:', normalizedEmail);
      return res.status(401).json({ 
        message: 'Invalid credentials. Please check your email and password.' 
      });
    }

    // Check if user is approved
    if (user.status !== 'approved') {
      console.log('User not approved. Status:', user.status);
      return res.status(403).json({ 
        message: 'Account pending approval. Please wait for admin approval.' 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Password does not match for user:', normalizedEmail);
      return res.status(401).json({ 
        message: 'Invalid credentials. Please check your email and password.' 
      });
    }

    console.log('Login successful for user:', normalizedEmail);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (admin only)
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending users (admin only)
router.get('/pending-users', adminAuth, async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: 'pending' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(pendingUsers);
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve user (admin only)
router.post('/approve-user/:userId', adminAuth, async (req, res) => {
  try {
    console.log('Received approval request for userId:', req.params.userId);
    
    if (!req.params.userId) {
      console.error('No userId provided in request params');
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await User.findById(req.params.userId);
    console.log('Found user:', user);
    
    if (!user) {
      console.error('User not found with ID:', req.params.userId);
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = 'approved';
    user.approvedAt = new Date();
    user.approvedBy = req.user.userId;
    await user.save();
    console.log('User successfully approved:', user);

    res.json({ message: 'User approved successfully' });
  } catch (error) {
    console.error('Approve user error details:', {
      userId: req.params.userId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'Server error during user approval',
      details: error.message 
    });
  }
});

// Reject user (admin only)
router.post('/reject-user/:userId', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = 'rejected';
    await user.save();

    res.json({ message: 'User rejected successfully' });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin users' });
    }

    await user.deleteOne();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 