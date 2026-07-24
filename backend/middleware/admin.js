const adminMiddleware = (req, res, next) => {
    // This middleware must be used AFTER authMiddleware
    if (!req.user) {
        return res.status(401).json({ message: 'Authorization denied. No user found.' });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden. Admin access required.' });
    }

    next();
};

module.exports = adminMiddleware;
