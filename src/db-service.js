/**
 * MongoDB database service for user code storage
 */
import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MongoDB connection URI
const uri = process.env.MONGODB_URI;

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
const CODE_SNIPPETS_COLLECTION = 'code-snippets';

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
 * Save a user to the database
 * @param {Object} user - User object
 * @returns {Promise<Object>} - Saved user with MongoDB _id
 */
export async function saveUser(user) {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection(USERS_COLLECTION);
    
    // Check if user already exists by email
    const existingUser = await usersCollection.findOne({ email: user.email });
    
    if (existingUser) {
      // Update existing user
      await usersCollection.updateOne(
        { email: user.email },
        { $set: { ...user, updatedAt: new Date() } }
      );
      return { ...existingUser, ...user };
    } else {
      // Insert new user
      const result = await usersCollection.insertOne({
        ...user,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return { ...user, _id: result.insertedId };
    }
  } catch (error) {
    console.error('Error saving user:', error);
    throw error;
  }
}

/**
 * Get a user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - User object or null if not found
 */
export async function getUserById(userId) {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection(USERS_COLLECTION);
    return await usersCollection.findOne({ id: userId });
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
}

/**
 * Save code snippet for a user
 * @param {string} userId - User ID
 * @param {string} language - Programming language
 * @param {string} code - Code snippet
 * @returns {Promise<Object>} - Saved code snippet
 */
export async function saveCodeSnippet(userId, language, code) {
  try {
    const db = await connectToDatabase();
    const snippetsCollection = db.collection(CODE_SNIPPETS_COLLECTION);
    
    // Check if snippet already exists for this user and language
    const existingSnippet = await snippetsCollection.findOne({
      userId,
      language
    });
    
    if (existingSnippet) {
      // Update existing snippet
      await snippetsCollection.updateOne(
        { userId, language },
        { $set: { code, updatedAt: new Date() } }
      );
      return { ...existingSnippet, code };
    } else {
      // Insert new snippet
      const snippet = {
        userId,
        language,
        code,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await snippetsCollection.insertOne(snippet);
      return { ...snippet, _id: result.insertedId };
    }
  } catch (error) {
    console.error('Error saving code snippet:', error);
    throw error;
  }
}

/**
 * Get code snippet for a user
 * @param {string} userId - User ID
 * @param {string} language - Programming language
 * @returns {Promise<string|null>} - Code snippet or null if not found
 */
export async function getCodeSnippet(userId, language) {
  try {
    const db = await connectToDatabase();
    const snippetsCollection = db.collection(CODE_SNIPPETS_COLLECTION);
    
    const snippet = await snippetsCollection.findOne({
      userId,
      language
    });
    
    return snippet ? snippet.code : null;
  } catch (error) {
    console.error('Error getting code snippet:', error);
    throw error;
  }
}

/**
 * Delete all code snippets for a user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteAllUserSnippets(userId) {
  try {
    const db = await connectToDatabase();
    const snippetsCollection = db.collection(CODE_SNIPPETS_COLLECTION);
    
    await snippetsCollection.deleteMany({ userId });
    return true;
  } catch (error) {
    console.error('Error deleting user snippets:', error);
    throw error;
  }
}
