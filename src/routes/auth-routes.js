/**
 * Authentication routes for user registration, login, and OAuth
 */
import express from 'express';
import { registerUser, loginUser, oauthLogin, verifyToken } from '../user-service.js';
import axios from 'axios';

const router = express.Router();

/**
 * Register a new user
 * POST /api/auth/register
 * Body: { email, password, name }
 */
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields: email and password are required' 
      });
    }
    
    const result = await registerUser(email, password, name);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(400).json({ error: error.message || 'Failed to register user' });
  }
});

/**
 * Login user with email and password
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields: email and password are required' 
      });
    }
    
    const result = await loginUser(email, password);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(401).json({ error: error.message || 'Failed to login' });
  }
});

/**
 * GitHub OAuth callback
 * POST /api/auth/github
 * Body: { code }
 */
router.post('/auth/github', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      },
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );
    
    const { access_token } = tokenResponse.data;
    
    if (!access_token) {
      return res.status(400).json({ error: 'Failed to get access token' });
    }
    
    // Get user profile
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${access_token}`
      }
    });
    
    // Get user email
    const emailResponse = await axios.get('https://api.github.com/user/emails', {
      headers: {
        Authorization: `token ${access_token}`
      }
    });
    
    const primaryEmail = emailResponse.data.find(email => email.primary)?.email || emailResponse.data[0]?.email;
    
    if (!primaryEmail) {
      return res.status(400).json({ error: 'Failed to get user email' });
    }
    
    // Create user profile
    const profile = {
      id: userResponse.data.id.toString(),
      name: userResponse.data.name || userResponse.data.login,
      email: primaryEmail,
      photoURL: userResponse.data.avatar_url
    };
    
    // Login or register user
    const result = await oauthLogin('github', profile);
    res.status(200).json(result);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.status(400).json({ error: error.message || 'GitHub authentication failed' });
  }
});

/**
 * Google OAuth callback
 * POST /api/auth/google
 * Body: { code }
 */
router.post('/auth/google', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/callback/google`,
        grant_type: 'authorization_code'
      }
    );
    
    const { access_token, id_token } = tokenResponse.data;
    
    if (!access_token) {
      return res.status(400).json({ error: 'Failed to get access token' });
    }
    
    // Get user profile
    const userResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      }
    );
    
    // Create user profile
    const profile = {
      id: userResponse.data.sub,
      name: userResponse.data.name,
      email: userResponse.data.email,
      photoURL: userResponse.data.picture
    };
    
    // Login or register user
    const result = await oauthLogin('google', profile);
    res.status(200).json(result);
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(400).json({ error: error.message || 'Google authentication failed' });
  }
});

/**
 * Verify user token
 * GET /api/auth/verify
 * Headers: { Authorization: Bearer <token> }
 */
router.get('/auth/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const user = await verifyToken(token);
    
    res.status(200).json({ user });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
