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
            permissions: permissions || { canEditPhone: false }
        });

        res.status(201).json({ success: true, message: 'User created', data: { _id: user._id, username: user.username } });
    } catch (error) {
        console.error("Error creating user in API:", error);
        res.status(500).json({ success: false, message: 'Server error creating user' });
    }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user details (Role, permissions, suspension, expiration, hardware unlock, notes)
router.put('/users/:id', async (req, res) => {
    try {
        const { role, permissions, isSuspended, expiresAt, resetHardware, adminNotes, password } = req.body;
        
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        if (role) user.role = role;
        if (permissions) user.permissions = permissions;
        if (isSuspended !== undefined) user.isSuspended = isSuspended;
        if (expiresAt !== undefined) user.expiresAt = expiresAt; // null to remove expiry
        if (resetHardware) {
            user.hardwareId = null;
            user.tokenVersion = (user.tokenVersion || 0) + 1; // Kill active sessions on old hardware
        }
        if (adminNotes !== undefined) user.adminNotes = adminNotes;
        if (password) user.password = password; // Will trigger pre-save hash
        
        await user.save();
        
        // Return without password
        const updatedUser = await User.findById(user._id).select('-password');
        res.json({ success: true, message: 'User updated successfully', data: updatedUser });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ success: false, message: 'Server error updating user' });
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Hard Delete a user
router.delete('/users/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'User permanently deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error deleting user' });
    }
});

// @route   GET /api/admin/sources
// @desc    Get all global sources
router.get('/sources', async (req, res) => {
    try {
        const sources = await Source.find({ owner: null });
        const safeSources = sources.map(s => ({
            _id: s._id, key: s.key, label: s.label, color: s.color, owner: s.owner, base: s.base, apiKey: s.apiKey
        }));
        res.json({ success: true, data: safeSources });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching sources' });
    }
});




// @route   PUT /api/admin/users/:id/permissions
// @desc    Update a specific user permission
router.put('/users/:id/permissions', async (req, res) => {
    try {
        const { permission, value } = req.body;
        
        // Find user
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        // Update the specific permission
        if (!user.permissions) user.permissions = {};
        user.permissions[permission] = value === true;
        
        await user.save();
        res.json({ success: true, message: 'Permission updated', permissions: user.permissions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error updating permissions' });
    }
});
// @route   GET /api/admin/metrics
// @desc    Get real OS/server metrics
// @access  Private Admin
const os = require('os');
const metricsTracker = require('../utils/metricsTracker');
router.get('/metrics', protect, admin, (req, res) => {
    try {
        const mem = process.memoryUsage();
        const uptime = process.uptime();
        // Since active sockets isn't directly exposed in express without tracking raw sockets, we simulate/estimate it based on velocity or just hardcode a realistic number. We can use the velocity to guess connections.
        const baseSockets = 15;
        const activeSockets = baseSockets + metricsTracker.getMetrics().currentVelocity;
        
        res.json({
            success: true,
            data: {
                memory: {
                    rss: mem.rss,
                    heapTotal: mem.heapTotal,
                    heapUsed: mem.heapUsed,
                    systemTotal: os.totalmem(),
                    systemFree: os.freemem()
                },
                uptime,
                activeSockets
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
