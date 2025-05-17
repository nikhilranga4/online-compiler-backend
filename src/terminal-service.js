import Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';

// Initialize Docker client with socket path from environment variables
const dockerSocketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
console.log('Terminal service using Docker socket path:', dockerSocketPath);

const docker = new Docker({
  socketPath: dockerSocketPath
});

// Store active terminal sessions
const activeSessions = new Map();

/**
 * Setup terminal WebSocket connection
 * @param {Object} socket - Socket.io socket
 */
export function setupTerminal(socket) {
  // Create a new terminal session
  socket.on('terminal_create', async (data) => {
    try {
      const { language } = data;
      const sessionId = uuidv4();
      
      // Default to a basic Linux container if language not specified
      const image = getImageForLanguage(language);
      
      console.log(`Creating terminal session ${sessionId} with image ${image}`);
      
      // Create container
      const container = await docker.createContainer({
        Image: image,
        Cmd: ['/bin/sh'],
        Tty: true,
        OpenStdin: true,
        StdinOnce: false,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        HostConfig: {
          NetworkMode: 'bridge', // Allow network for terminal usage
          Memory: 512 * 1024 * 1024, // 512MB memory limit
          MemorySwap: 512 * 1024 * 1024, // Disable swap
          CpuPeriod: 100000,
          CpuQuota: 50000, // 50% CPU
          PidsLimit: 100, // Limit processes
          AutoRemove: true // Auto remove when stopped
        }
      });
      
      // Start container
      await container.start();
      
      // Attach to container
      const stream = await container.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true
      });
      
      // Store session
      activeSessions.set(sessionId, {
        container,
        stream,
        language
      });
      
      // Handle data from container
      stream.on('data', (chunk) => {
        socket.emit('terminal_output', {
          sessionId,
          output: chunk.toString()
        });
      });
      
      // Send session ID to client
      socket.emit('terminal_created', {
        sessionId,
        message: 'Terminal session created'
      });
      
      // Handle terminal resize
      socket.on(`terminal_resize_${sessionId}`, async (data) => {
        try {
          const { cols, rows } = data;
          const session = activeSessions.get(sessionId);
          
          if (session) {
            await session.container.resize({ h: rows, w: cols });
          }
        } catch (error) {
          console.error('Error resizing terminal:', error);
        }
      });
      
      // Handle terminal input
      socket.on(`terminal_input_${sessionId}`, (data) => {
        try {
          const { input } = data;
          const session = activeSessions.get(sessionId);
          
          if (session) {
            session.stream.write(input);
          }
        } catch (error) {
          console.error('Error sending input to terminal:', error);
        }
      });
      
      // Handle terminal close
      socket.on(`terminal_close_${sessionId}`, async () => {
        await closeTerminalSession(sessionId);
      });
      
      // Handle socket disconnect
      socket.on('disconnect', async () => {
        // Close all sessions associated with this socket
        for (const [id, session] of activeSessions.entries()) {
          if (session.socket === socket) {
            await closeTerminalSession(id);
          }
        }
      });
      
    } catch (error) {
      console.error('Error creating terminal session:', error);
      socket.emit('terminal_error', {
        error: 'Failed to create terminal session'
      });
    }
  });
}

/**
 * Close a terminal session
 * @param {string} sessionId - Session ID
 */
async function closeTerminalSession(sessionId) {
  try {
    const session = activeSessions.get(sessionId);
    
    if (session) {
      // Stop container
      await session.container.stop();
      
      // Remove session
      activeSessions.delete(sessionId);
      
      console.log(`Terminal session ${sessionId} closed`);
    }
  } catch (error) {
    console.error(`Error closing terminal session ${sessionId}:`, error);
  }
}

/**
 * Get Docker image for language
 * @param {string} language - Programming language
 * @returns {string} - Docker image name
 */
function getImageForLanguage(language) {
  if (!language) {
    return 'alpine:latest'; // Default to Alpine Linux
  }
  
  // Map language to appropriate Docker image
  const imageMap = {
    javascript: 'node:16-alpine',
    python: 'python:3.9-alpine',
    java: 'openjdk:11-jdk-slim',
    cpp: 'gcc:latest',
    c: 'gcc:latest',
    go: 'golang:alpine',
    ruby: 'ruby:alpine',
    rust: 'rust:slim',
    php: 'php:cli-alpine'
  };
  
  return imageMap[language.toLowerCase()] || 'alpine:latest';
}
