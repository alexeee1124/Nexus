const mongoose = require('mongoose');

const SourceSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    label: {
        type: String,
        required: true,
        trim: true
    },
    base: {
        type: String,
        required: true,
        trim: true
    },
    apiKey: {
        type: String,
        default: null
    },
    color: {
        type: String,
        default: () => `hsl(${Math.floor(Math.random() * 360)}, 100%, 65%)`
    },
    // If owner is null, it's a global Master Firebase managed by the Admin.
    // If owner is set, it's a Private Tenant Firebase only visible to that specific user (and Admin).
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.models.Source || mongoose.model('Source', SourceSchema);
