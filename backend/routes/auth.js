const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const connectDB = require('../config/db');

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    try {
        await connectDB();
        
        const { username, password } = req.body;

        // Basic validation
        if (!username || !password) {
            return res.status(400).json({ message: 'Please provide both username and password.' });
        }

        // Check for user in database
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(403).json({ message: 'Account suspended. Contact administrator.' });
        }

        // Validate password using our schema method
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Create JWT Payload
        const payload = {
            id: user._id,
            username: user.username,
            role: user.role,
            permissions: user.permissions
        };

        // Sign token (expires in 24 hours)
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({
                    token,
                    user: {
                        id: user._id,
                        username: user.username,
                        role: user.role,
                        permissions: user.permissions
                    }
                });
            }
        );

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ message: 'Server Error during authentication.' });
    }
});

module.exports = router;
