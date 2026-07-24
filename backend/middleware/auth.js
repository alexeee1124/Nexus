const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Check for token in headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Add user payload to request
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is invalid or has expired.' });
    }
};

module.exports = authMiddleware;
