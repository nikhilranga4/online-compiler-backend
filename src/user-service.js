/**
 * User authentication and management service
 */
import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

// MongoDB connection URI
const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'online-compiler-secret-key';

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Database and collection names
const DB_NAME = 'online-compiler';
const USERS_COLLECTION = 'users';

/**
 * Connect to MongoDB
 */
async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    return client.db(DB_NAME);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

/**
 * Hash password with SHA-256
 * @param {string} password - Plain text password
 * @returns {string} - Hashed password
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} - JWT token
 */
function generateToken(user) {
  // Remove password from token payload
  const { password, ...userWithoutPassword } = user;
  
  return jwt.sign(userWithoutPassword, JWT_SECRET, {
    expiresIn: '7d' // Token expires in 7 days
  });
}

/**
 * Register a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} name - User name (optional)
 * @returns {Promise<Object>} - User object and token
 */
export async function registerUser(email, password, name = '') {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection(USERS_COLLECTION);
    
    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Create new user
    const hashedPassword = hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      email,
      password: hashedPassword,
      name: name || email.split('@')[0], // Use part of email as name if not provided
      provider: 'email',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save user to database
    await usersCollection.insertOne(user);
    
    // Generate token
    const token = generateToken(user);
    
    // Return user without password and token
    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token
    };
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
}

/**
 * Login user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - User object and token
 */
export async function loginUser(email, password) {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection(USERS_COLLECTION);
    
    // Find user by email
    const user = await usersCollection.findOne({ email });
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check password
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      throw new Error('Invalid password');
    }
    
    // Update last login time
    await usersCollection.updateOne(
      { email },
      { $set: { lastLoginAt: new Date() } }
    );
    
    // Generate token
    const token = generateToken(user);
    
    // Return user without password and token
    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token
    };
  } catch (error) {
    console.error('Error logging in user:', error);
    throw error;
  }
}

/**
 * Handle OAuth login (GitHub, Google)
 * @param {string} provider - OAuth provider (github, google)
 * @param {Object} profile - User profile from OAuth provider
 * @returns {Promise<Object>} - User object and token
 */
export async function oauthLogin(provider, profile) {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection(USERS_COLLECTION);
    
    // Check if user already exists with this provider and ID
    let user = await usersCollection.findOne({
      provider,
      providerId: profile.id
    });
    
    if (!user) {
      // Check if user exists with same email
      user = await usersCollection.findOne({ email: profile.email });
      
      if (user) {
        // Update existing user with provider info
        await usersCollection.updateOne(
          { email: profile.email },
          {
            $set: {
              provider,
              providerId: profile.id,
              name: profile.name || user.name,
              photoURL: profile.photoURL || user.photoURL,
              updatedAt: new Date(),
              lastLoginAt: new Date()
            }
          }
        );
        
        // Get updated user
        user = await usersCollection.findOne({ email: profile.email });
      } else {
        // Create new user
        user = {
          id: crypto.randomUUID(),
          email: profile.email,
          name: profile.name || profile.email.split('@')[0],
          photoURL: profile.photoURL,
          provider,
          providerId: profile.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: new Date()
        };
        
        // Save user to database
        await usersCollection.insertOne(user);
      }
    } else {
      // Update last login time
      await usersCollection.updateOne(
        { provider, providerId: profile.id },
        { $set: { lastLoginAt: new Date() } }
      );
    }
    
    // Generate token
    const token = generateToken(user);
    
    // Return user and token
    return {
      user,
      token
    };
  } catch (error) {
    console.error(`Error with ${provider} login:`, error);
    throw error;
  }
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Promise<Object>} - User object
 */
export async function verifyToken(token) {
  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const db = await connectToDatabase();
    const usersCollection = db.collection(USERS_COLLECTION);
    
    const user = await usersCollection.findOne({ id: decoded.id });
    if (!user) {
      throw new Error('User not found');
    }
    
    // Return user without password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error verifying token:', error);
    throw error;
  }
}
