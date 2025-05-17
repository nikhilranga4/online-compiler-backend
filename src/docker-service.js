import Docker from 'dockerode';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { exec } from 'child_process';

const execPromise = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Docker client with socket path from environment variables
const dockerSocketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
console.log('Using Docker socket path:', dockerSocketPath);

const docker = new Docker({
  socketPath: dockerSocketPath
});

// Language configurations
const languageConfigs = {
  javascript: {
    image: 'node:16-alpine',
    extension: 'js',
    command: ['node', '/code/program.js'],
    workDir: '/code'
  },
  python: {
    image: 'python:3.9-alpine',
    extension: 'py',
    command: ['python', '/code/program.py'],
    workDir: '/code'
  },
  java: {
    image: 'openjdk:11-jdk-slim',
    extension: 'java',
    command: ['bash', '-c', 'cd /code && javac Main.java && java Main'],
    workDir: '/code'
  },
  cpp: {
    image: 'gcc:latest',
    extension: 'cpp',
    command: ['bash', '-c', 'cd /code && g++ -o program program.cpp && ./program'],
    workDir: '/code'
  },
  c: {
    image: 'gcc:latest',
    extension: 'c',
    command: ['bash', '-c', 'cd /code && gcc -o program program.c && ./program'],
    workDir: '/code'
  }
};

/**
 * Execute code in a Docker container
 * @param {string} code - The code to execute
 * @param {string} language - The programming language
 * @param {string} input - Standard input for the program
 * @returns {Promise<Object>} - Execution result
 */
export async function executeCode(code, language, input = '') {
  const config = languageConfigs[language.toLowerCase()];
  
  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }
  
  const executionId = uuidv4();
  const tempDir = path.join(__dirname, '..', 'temp', executionId);
  
  try {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });
    
    // Determine filename based on language
    let filename;
    if (language.toLowerCase() === 'java') {
      // For Java, we need to extract the class name or use Main.java
      const classNameMatch = code.match(/public\s+class\s+(\w+)/);
      const className = classNameMatch ? classNameMatch[1] : 'Main';
      filename = `${className}.java`;
    } else {
      filename = `program.${config.extension}`;
    }
    
    // Write code to file
    await fs.writeFile(path.join(tempDir, filename), code);
    
    // Write input to file if provided
    if (input) {
      await fs.writeFile(path.join(tempDir, 'input.txt'), input);
    }
    
    // Pull the Docker image if not already available
    try {
      await docker.getImage(config.image).inspect();
    } catch (error) {
      console.log(`Pulling image: ${config.image}`);
      await pullImage(config.image);
    }
    
    // Create and run container
    const container = await docker.createContainer({
      Image: config.image,
      Cmd: config.command,
      WorkingDir: config.workDir,
      HostConfig: {
        Binds: [`${tempDir}:/code`],
        NetworkMode: 'none', // Disable network access for security
        Memory: 512 * 1024 * 1024, // 512MB memory limit
        MemorySwap: 512 * 1024 * 1024, // Disable swap
        CpuPeriod: 100000, // CPU quota period in microseconds
        CpuQuota: 50000, // CPU quota (50% of CPU)
        PidsLimit: 50, // Limit number of processes
        ReadonlyRootfs: true, // Read-only root filesystem
        AutoRemove: true // Automatically remove container when it exits
      },
      Tty: false,
      OpenStdin: true,
      StdinOnce: true
    });
    
    // Start the container
    await container.start();
    
    // Write input to container stdin if provided
    if (input) {
      const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
      stream.write(input);
      stream.end();
    }
    
    // Wait for container to finish
    const data = await container.wait();
    
    // Get container logs
    const logs = await container.logs({
      stdout: true,
      stderr: true
    });
    
    // Parse logs
    const output = logs.toString();
    
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    
    return {
      executionId,
      status: data.StatusCode === 0 ? 'success' : 'error',
      output: output,
      exitCode: data.StatusCode
    };
  } catch (error) {
    console.error('Error executing code:', error);
    
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Error cleaning up temp directory:', cleanupError);
    }
    
    return {
      executionId,
      status: 'error',
      output: error.message,
      exitCode: 1
    };
  }
}

/**
 * Pull a Docker image
 * @param {string} image - The image to pull
 * @returns {Promise<void>}
 */
async function pullImage(image) {
  return new Promise((resolve, reject) => {
    docker.pull(image, (err, stream) => {
      if (err) {
        return reject(err);
      }
      
      docker.modem.followProgress(stream, (err, output) => {
        if (err) {
          return reject(err);
        }
        resolve(output);
      });
    });
  });
}

/**
 * Run a command in a Docker container
 * @param {string} containerId - The container ID
 * @param {string} command - The command to execute
 * @returns {Promise<Object>} - Command execution result
 */
export async function runCommandInContainer(containerId, command) {
  try {
    const container = docker.getContainer(containerId);
    
    const exec = await container.exec({
      Cmd: ['sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true
    });
    
    const stream = await exec.start();
    
    return new Promise((resolve, reject) => {
      let output = '';
      
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });
      
      stream.on('end', () => {
        resolve({ output });
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    console.error('Error running command in container:', error);
    return { error: error.message };
  }
}
