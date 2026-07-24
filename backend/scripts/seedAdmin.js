const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { bufferCommands: false });
        console.log('MongoDB Connected for Seeding...');

        // Check if admin already exists
        const adminExists = await User.findOne({ role: 'admin' });
        
        if (adminExists) {
            console.log('Master Admin already exists in the database. Aborting seed.');
            process.exit();
        }

        const admin = await User.create({
            username: 'nexus_admin',
            password: 'SuperSecretPassword123!', // This will be hashed automatically by the Mongoose pre-save hook
            role: 'admin',
            permissions: {
                canEditPhone: true,
                canViewTelecomIntel: true
            }
        });

        console.log('Master Admin Created Successfully:', admin.username);
        process.exit();
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedAdmin();
