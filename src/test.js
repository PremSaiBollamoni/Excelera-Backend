import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function testConnection() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Successfully connected to MongoDB!');

    // Test user creation
    const testUser = new User({
      email: 'test@example.com',
      password: 'testpassword123',
      name: 'Test User'
    });

    await testUser.save();
    console.log('Test user created successfully!');

    // Find the test user
    const foundUser = await User.findOne({ email: 'test@example.com' });
    console.log('Found user:', foundUser.email);

    // Clean up - delete test user
    await User.deleteOne({ email: 'test@example.com' });
    console.log('Test user deleted successfully!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

testConnection(); 