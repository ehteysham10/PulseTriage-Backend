import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import ticketRoutes from './routes/ticketRoutes.js';
import setupSocket from './socket/socketHandler.js';
import { startSlaWorker } from './queues/slaWorker.js';

// Load env vars
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust for production
    methods: ['GET', 'POST']
  }
});

// Attach socket.io to the app so controllers can use it
app.set('io', io);

// Initialize socket handlers
setupSocket(io);

// Initialize SLA worker
startSlaWorker();

// Middleware
app.use(express.json());

// Routes
app.use('/api/tickets', ticketRoutes);

// Basic root route for testing
app.get('/', (req, res) => {
  res.send('PulseTriage API is running...');
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
