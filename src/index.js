import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import codeRoutes from './routes/code-routes.js';
import authRoutes from './routes/auth-routes.js';
import learningRoutes from './routes/learning-routes.js';
// Import mock Docker service instead of real Docker service
// Comment out the real Docker service import
// import { executeCode } from './docker-service.js';
import { executeCode } from './mock-docker-service.js';
// Import mock terminal service instead of real terminal service
// Comment out the real terminal service import
// import { setupTerminal } from './terminal-service.js';
import { setupTerminal } from './mock-terminal-service.js';

// Load environment variables
dotenv.config();

// Log environment variables (for debugging)
console.log('Environment variables loaded:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('DOCKER_SOCKET:', process.env.DOCKER_SOCKET);

const app = express();
const server = http.createServer(app);
// Get frontend URL from environment variables
const frontendUrl = process.env.FRONTEND_URL || '*';

// For development and testing, allow requests from any origin
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
};

const io = new Server(server, {
  cors: corsOptions
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Register routes
app.use('/api', codeRoutes);
app.use('/api', authRoutes);
app.use('/api', learningRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Execute code endpoint
app.post('/api/execute', async (req, res) => {
  try {
    const { code, language, input } = req.body;
    
    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }
    
    const executionId = uuidv4();
    
    // Execute code with input and get result immediately
    try {
      console.log(`Executing ${language} code with input: ${input ? 'provided' : 'none'}`);
      console.log('Code snippet:', code.substring(0, 50) + (code.length > 50 ? '...' : ''));
      
      // Execute code with user input
      const result = await executeCode(code, language, input);
      
      // Send response with execution ID and result
      res.status(200).json({ 
        executionId,
        message: 'Code execution completed',
        result: result
      });
      
      // Also emit via WebSocket for clients that are listening
      io.to(executionId).emit('execution_result', result);
    } catch (execError) {
      console.error('Error during code execution:', execError);
      // Send error response
      return res.status(500).json({ 
        error: 'Code execution failed', 
        message: execError.message,
        executionId
      });
    }
  } catch (error) {
    console.error('Error processing execute request:', error);
    res.status(500).json({ error: 'Failed to process execute request' });
  }
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Join execution room
  socket.on('join_execution', (executionId) => {
    socket.join(executionId);
    console.log(`Socket ${socket.id} joined execution ${executionId}`);
  });
  
  // Setup terminal connection
  setupTerminal(socket);
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
