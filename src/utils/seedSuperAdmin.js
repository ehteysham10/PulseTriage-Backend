import User from '../models/User.js';

/**
 * Seeds the Super Admin account into the database on server startup.
 * Only runs if the Super Admin does not already exist.
 */
const seedSuperAdmin = async () => {
  try {
    const exists = await User.findOne({ isSuperAdmin: true });
    if (exists) {
      console.log('✅ Super Admin already exists. Skipping seed.');
      return;
    }

    await User.create({
      username: 'theadmin',
      name: 'The Admin',
      email: 'iamehtisham10@gmail.com',
      password: '54321$eht',
      role: 'Admin',
      approvalStatus: 'Approved',
      isSuperAdmin: true
    });

    console.log('🌱 Super Admin seeded successfully.');
  } catch (error) {
    console.error('❌ Failed to seed Super Admin:', error.message);
  }
};

export default seedSuperAdmin;
