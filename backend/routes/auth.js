const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check for user
        const user = await User.findOne({ username });
        
        // Ensure user exists, is active, and password matches
        if (user && user.isActive && (await user.comparePassword(password))) {
            res.json({
                success: true,
                _id: user._id,
                username: user.username,
                role: user.role,
                permissions: user.permissions,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials or account suspended' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
const { protect } = require('../middleware/authMiddleware');
router.get('/me', protect, (req, res) => {
    res.json({
        success: true,
        _id: req.user._id,
        username: req.user.username,
        role: req.user.role,
        permissions: req.user.permissions
    });
});

module.exports = router;
