/**
 * API routes for code snippet storage
 */
import express from 'express';
import { saveCodeSnippet, getCodeSnippet } from '../db-service.js';

const router = express.Router();

/**
 * Save code snippet for a user
 * POST /api/code
 * Body: { userId, language, code }
 */
router.post('/code', async (req, res) => {
  try {
    const { userId, language, code } = req.body;
    
    if (!userId || !language || !code) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, language, and code are required' 
      });
    }
    
    const savedSnippet = await saveCodeSnippet(userId, language, code);
    res.status(201).json(savedSnippet);
  } catch (error) {
    console.error('Error saving code snippet:', error);
    res.status(500).json({ error: 'Failed to save code snippet' });
  }
});

/**
 * Get code snippet for a user
 * GET /api/code/:userId/:language
 */
router.get('/code/:userId/:language', async (req, res) => {
  try {
    const { userId, language } = req.params;
    
    if (!userId || !language) {
      return res.status(400).json({ 
        error: 'Missing required parameters: userId and language are required' 
      });
    }
    
    const snippet = await getCodeSnippet(userId, language);
    
    if (!snippet) {
      return res.status(404).json({ error: 'Code snippet not found' });
    }
    
    res.status(200).json({ code: snippet });
  } catch (error) {
    console.error('Error getting code snippet:', error);
    res.status(500).json({ error: 'Failed to get code snippet' });
  }
});

export default router;
