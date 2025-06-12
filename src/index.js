import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import excelRoutes from './routes/excel.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  
  res.json({
    status: 'ok',
    timestamp: new Date(),
    database: {
      state: dbStates[dbState],
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    },
    uptime: process.uptime()
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/excel', excelRoutes);

// MongoDB Connection with improved options
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
  socketTimeoutMS: 45000, // Socket timeout
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  w: 'majority',
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000,
  heartbeatFrequencyMS: 2000,
  retryReads: true,
  family: 4 // Use IPv4, skip trying IPv6
})
.then(() => {
  console.log('Connected to MongoDB');
  // Log connection details for debugging
  const { host, port, name } = mongoose.connection;
  console.log(`Connected to database: ${name} at ${host}:${port}`);
})
.catch((err) => {
  console.error('MongoDB connection error:', err);
  console.error('Connection string (masked):', process.env.MONGODB_URI?.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));
  process.exit(1);
});

// Add connection error handler
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  console.error('Connection state:', mongoose.connection.readyState);
});

// Add disconnection handler
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
  console.log('Attempting to reconnect...');
});

// Add reconnection handler
mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during connection closure:', err);
    process.exit(1);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 
