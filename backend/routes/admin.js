const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Source = require('../models/Source');
const { protect, admin } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

// Apply middleware to all routes in this file
router.use(protect);
router.use(admin);

// @route   GET /api/admin/users
// @desc    Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching users' });
    }
});

// @route   POST /api/admin/users
// @desc    Create a new user
router.post('/users', async (req, res) => {
    try {
        const { username, password, role, permissions } = req.body;
        
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const user = await User.create({
            username,
            password,
            role: role || 'user',
            permissions: permissions || { canEditPhone: false, canViewTelecomIntel: false }
        });

        res.status(201).json({ success: true, message: 'User created', data: { _id: user._id, username: user.username } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error creating user' });
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Suspend or Delete a user
router.delete('/users/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error deleting user' });
    }
});

// @route   GET /api/admin/sources
// @desc    Get all global sources
router.get('/sources', async (req, res) => {
    try {
        const sources = await Source.find({ owner: null });
        res.json({ success: true, data: sources });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching sources' });
    }
});

// @route   POST /api/admin/sources
// @desc    Add a global master Firebase source
router.post('/sources', async (req, res) => {
    try {
        const { key, label, base, apiKey, color } = req.body;
        const source = await Source.create({
            key, label, base, apiKey, color, owner: null
        });
        res.status(201).json({ success: true, data: source });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Source key already exists' });
        res.status(500).json({ success: false, message: 'Server error creating source' });
    }
});

module.exports = router;
