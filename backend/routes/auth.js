const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const requestIp = require('request-ip');
const geoip = require('geoip-lite');
const parser = require('ua-parser-js');
const axios = require('axios');

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { username, password, hardwareId } = req.body; // Expecting frontend to send a basic browser fingerprint

        // Check for user
        const user = await User.findOne({ username });
        
        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: 'Invalid credentials or account deactivated' });
        }
        
        if (user.isSuspended) {
            return res.status(403).json({ success: false, message: 'Account suspended. Contact administrator.' });
        }
        
        if (user.expiresAt && new Date() > new Date(user.expiresAt)) {
            return res.status(403).json({ success: false, message: 'Account access has expired.' });
        }

        // Check password
        if (!(await user.comparePassword(password))) {
             return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Enforce Hardware Binding if provided by frontend
        if (hardwareId && user.role !== 'admin') { // Admins might bypass hardware locks
            if (!user.hardwareId) {
                // First time login, bind hardware
                user.hardwareId = hardwareId;
            } else if (user.hardwareId !== hardwareId) {
                return res.status(403).json({ success: false, message: 'Hardware mismatch. Device locked.' });
            }
        }

        // Telemetry extraction
        let clientIp = requestIp.getClientIp(req);
        if (clientIp === '::1' || clientIp === '127.0.0.1') {
            clientIp = '8.8.8.8'; // Mock for local testing if needed
        }
        
        let locStr = 'Unknown Location';
        try {
            const geoRes = await axios.get(`https://get.geojs.io/v1/ip/geo/${clientIp}.json`, { timeout: 2000 });
            if (geoRes.data) {
                const city = geoRes.data.city || '';
                const region = geoRes.data.region || '';
                const country = geoRes.data.country || '';
                if (city) locStr = `${city}, ${country}`;
                else if (region) locStr = `${region}, ${country}`;
                else if (country) locStr = country;
            }
        } catch (err) {
            // Fallback to geoip-lite
            const geo = geoip.lookup(clientIp);
            if (geo) {
                const city = geo.city || '';
                const country = geo.country || '';
                if (city) locStr = `${city}, ${country}`;
                else if (country) locStr = country;
            }
        }
        
        const ua = parser(req.headers['user-agent']);
        
        user.lastLoginDate = new Date();
        user.lastIp = clientIp === '8.8.8.8' ? requestIp.getClientIp(req) : clientIp; // Restore actual IP if mocked
        user.lastLocation = locStr;
        user.lastDevice = `${ua.browser.name || 'Unknown'} on ${ua.os.name || 'Unknown'}`;
        
        await user.save();

        res.json({
            success: true,
            _id: user._id,
            username: user.username,
            role: user.role,
            permissions: user.permissions,
            token: generateToken(user._id)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// Seed endpoint removed for security. Use CLI or environment variable to create initial admin.

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
