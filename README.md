# Online Compiler Backend

This is the backend service for the Online Compiler application. It provides APIs for executing code in various programming languages using Docker containers and supports an interactive terminal.

## Features

- Code execution in isolated Docker containers
- Support for multiple programming languages (JavaScript, Python, Java, C++, C)
- Interactive terminal sessions
- Real-time output streaming via WebSockets
- Secure execution environment with resource limits

## Prerequisites

- Node.js (v14+)
- Docker
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration.

## Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

## Docker Setup

To build and run the backend service in Docker:

```bash
# Build the Docker image
docker build -t online-compiler-backend .

# Run the container
docker run -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock online-compiler-backend
```

Note: Mounting the Docker socket allows the container to create sibling containers for code execution.

## API Endpoints

### Execute Code

```
POST /api/execute
```

Request body:
```json
{
  "code": "console.log('Hello, World!');",
  "language": "javascript",
  "input": ""
}
```

Response:
```json
{
  "executionId": "uuid",
  "message": "Code execution started"
}
```

The actual execution result will be sent via WebSocket.

### Health Check

```
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

## WebSocket Events

### Client to Server

- `join_execution`: Join an execution room to receive results
- `terminal_create`: Create a new terminal session
- `terminal_input_${sessionId}`: Send input to a terminal session
- `terminal_resize_${sessionId}`: Resize a terminal session
- `terminal_close_${sessionId}`: Close a terminal session

### Server to Client

- `execution_result`: Code execution result
- `terminal_created`: Terminal session created
- `terminal_output`: Output from terminal session
- `terminal_error`: Error in terminal session

## Security Considerations

- Docker containers run with limited resources
- Network access is disabled for code execution
- Read-only root filesystem
- Process limits to prevent fork bombs
- Memory and CPU limits

## Deployment

For production deployment, consider using a container orchestration platform like Kubernetes or a managed service like AWS ECS.

## License

MIT
