const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            
            // Decode token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Attach user to the request object, excluding the password
            req.user = await User.findById(decoded.id).select('-password');
            
            if (!req.user || !req.user.isActive) {
                return res.status(401).json({ success: false, message: 'Not authorized or account suspended' });
            }
            
            if (req.user.isSuspended) {
                return res.status(401).json({ success: false, message: 'Account is suspended.' });
            }
            
            if (req.user.expiresAt && new Date() > new Date(req.user.expiresAt)) {
                return res.status(401).json({ success: false, message: 'Account access has expired.' });
            }
            
            const tokenVer = decoded.version || 0;
            if (req.user.tokenVersion !== tokenVer) {
                return res.status(401).json({ success: false, message: 'Session invalidated by a new login or hardware reset.' });
            }
            
            next();
        } catch (error) {
            console.error('JWT Verification Error:', error);
            res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
    }
};

module.exports = { protect, admin };
