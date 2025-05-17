/**
 * Mock Terminal service for testing without Docker
 * This simulates terminal sessions without actually using Docker containers
 */

import { v4 as uuidv4 } from 'uuid';

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
      
      console.log(`Creating mock terminal session ${sessionId} for ${language || 'default'} environment`);
      
      // Store session
      activeSessions.set(sessionId, {
        language,
        socket,
        history: [],
        active: true
      });
      
      // Send session ID to client
      socket.emit('terminal_created', {
        sessionId,
        message: 'Mock terminal session created'
      });
      
      // Send initial terminal output
      socket.emit('terminal_output', {
        sessionId,
        output: getWelcomeMessage(language)
      });
      
      // Handle terminal input
      socket.on(`terminal_input_${sessionId}`, (data) => {
        try {
          const { input } = data;
          const session = activeSessions.get(sessionId);
          
          if (session && session.active) {
            // Store command in history
            session.history.push(input);
            
            // Process command and send response
            setTimeout(() => {
              const output = processCommand(input, language);
              socket.emit('terminal_output', {
                sessionId,
                output
              });
            }, 300); // Add small delay for realism
          }
        } catch (error) {
          console.error('Error processing terminal input:', error);
          socket.emit('terminal_output', {
            sessionId,
            output: `Error: ${error.message}`
          });
        }
      });
      
      // Handle terminal close
      socket.on(`terminal_close_${sessionId}`, async () => {
        await closeTerminalSession(sessionId);
        socket.emit('terminal_output', {
          sessionId,
          output: 'Terminal session closed.'
        });
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
      console.error('Error creating mock terminal session:', error);
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
      session.active = false;
      
      // Remove session after a delay
      setTimeout(() => {
        activeSessions.delete(sessionId);
        console.log(`Mock terminal session ${sessionId} closed`);
      }, 1000);
    }
  } catch (error) {
    console.error(`Error closing mock terminal session ${sessionId}:`, error);
  }
}

/**
 * Process terminal command
 * @param {string} command - Command to process
 * @param {string} language - Programming language
 * @returns {string} - Command output
 */
function processCommand(command, language) {
  const cmd = command.trim();
  
  // Basic command simulation
  if (cmd === '') {
    return '';
  } else if (cmd.startsWith('echo ')) {
    return cmd.substring(5);
  } else if (cmd === 'ls' || cmd === 'dir') {
    return 'example.txt\nREADME.md\nsrc/\nnode_modules/';
  } else if (cmd === 'pwd' || cmd === 'cd') {
    return '/home/user';
  } else if (cmd === 'whoami') {
    return 'user';
  } else if (cmd === 'date') {
    return new Date().toString();
  } else if (cmd.startsWith('cat ')) {
    return `Content of ${cmd.substring(4)}:\nThis is a simulated file content.`;
  } else if (cmd === 'help') {
    return 'Available commands: echo, ls, pwd, whoami, date, cat, help, clear';
  } else if (cmd === 'clear') {
    return '\x1Bc'; // ANSI escape code to clear screen
  } else if (cmd.startsWith('python') || cmd.startsWith('node') || cmd.startsWith('java')) {
    return `Simulated ${cmd.split(' ')[0]} execution...\nHello, World!\nExecution complete.`;
  } else {
    return `Command not found: ${cmd}\nThis is a simulated terminal environment with limited functionality.`;
  }
}

/**
 * Get welcome message based on language
 * @param {string} language - Programming language
 * @returns {string} - Welcome message
 */
function getWelcomeMessage(language) {
  let message = 'Welcome to the simulated terminal environment!\n\n';
  
  switch (language) {
    case 'javascript':
      message += 'Node.js v16.14.0\n> ';
      break;
    case 'python':
      message += 'Python 3.9.7\n>>> ';
      break;
    case 'java':
      message += 'OpenJDK 11.0.11\n$ ';
      break;
    case 'cpp':
    case 'c':
      message += 'GCC 11.2.0\n$ ';
      break;
    default:
      message += '$ ';
  }
  
  return message;
}
