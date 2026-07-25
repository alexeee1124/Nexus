const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    permissions: {
        canEditPhone: { type: Boolean, default: false },
        canUseAutoDiscovery: { type: Boolean, default: false }
    },
    lastLoginDate: { type: Date },
    lastIp: { type: String },
    lastLocation: { type: String }, // City, Country
    lastDevice: { type: String }, // Browser & OS
    isSuspended: { type: Boolean, default: false },
    expiresAt: { type: Date }, // Time-Bomb Access
    hardwareId: { type: String }, // Hardware Binding / Fingerprint
    adminNotes: { type: String }, // Encrypted Notes (or just text readable only by admin)
    tokenVersion: { type: Number, default: 0 } // For session invalidation
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password for login
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
