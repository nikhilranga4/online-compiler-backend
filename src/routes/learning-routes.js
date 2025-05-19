/**
 * Learning routes for AI-powered interactive learning paths
 */
import express from 'express';
import { verifyToken } from '../user-service.js';
import axios from 'axios';

const router = express.Router();

// OpenRouter API key for AI-powered code analysis using DeepSeek V3
const OPENROUTER_API_KEY = process.env.OPENAI_API_KEY; // Using the same env variable for compatibility

// In-memory storage for user progress (temporary solution)
const userProgress = {};

/**
 * Middleware to verify user authentication
 * This is optional for public endpoints but required for user-specific data
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Continue without authentication for public endpoints
      req.user = null;
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    try {
      const user = await verifyToken(token);
      req.user = user;
    } catch (tokenError) {
      console.warn('Invalid token, continuing as anonymous user');
      req.user = null;
    }
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    // Continue as anonymous user instead of returning an error
    req.user = null;
    next();
  }
};

/**
 * Optional authentication middleware
 * This allows both authenticated and anonymous users to access endpoints
 */
const optionalAuth = authenticateUser;

/**
 * Get all learning paths with optional filtering
 * GET /api/learning/paths
 */
router.get('/learning/paths', authenticateUser, async (req, res) => {
  try {
    // Return sample learning paths
    res.json(getSampleLearningPaths());
  } catch (error) {
    console.error('Error getting learning paths:', error);
    res.status(500).json({ error: 'Failed to get learning paths' });
  }
});

/**
 * Get a specific learning path by ID
 * GET /api/learning/paths/:id
 */
router.get('/learning/paths/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find path in sample paths
    const samplePaths = getSampleLearningPaths();
    const path = samplePaths.find(p => p.id === id);
    
    if (!path) {
      return res.status(404).json({ error: 'Learning path not found' });
    }
    
    res.json(path);
  } catch (error) {
    console.error('Error getting learning path:', error);
    res.status(500).json({ error: 'Failed to get learning path' });
  }
});

/**
 * Get a specific code challenge by ID
 * GET /api/learning/challenges/:id
 */
router.get('/learning/challenges/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find challenge in sample paths
    const samplePaths = getSampleLearningPaths();
    let challenge = null;
    
    for (const path of samplePaths) {
      const found = path.challenges.find(c => c.id === id);
      if (found) {
        challenge = found;
        break;
      }
    }
    
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    
    res.json(challenge);
  } catch (error) {
    console.error('Error getting challenge:', error);
    res.status(500).json({ error: 'Failed to get challenge' });
  }
});

/**
 * Submit a solution for a code challenge
 * POST /api/learning/challenges/:id/submit
 * Body: { code }
 */
router.post('/learning/challenges/:id/submit', optionalAuth, async (req, res) => {
  console.log('Received solution submission request for challenge:', req.params.id);
  console.log('Authentication status:', req.user ? 'Authenticated' : 'Anonymous');
  
  try {
    const { id } = req.params;
    const { code } = req.body;
    
    console.log('Code received, length:', code ? code.length : 0, 'characters');
    
    if (!code) {
      console.log('Error: No code provided in the request');
      return res.status(400).json({ error: 'Code solution is required' });
    }
    
    // Find challenge in sample paths
    console.log('Looking for challenge in sample learning paths');
    const samplePaths = getSampleLearningPaths();
    console.log('Number of learning paths:', samplePaths.length);
    
    let challenge = null;
    
    for (const path of samplePaths) {
      console.log(`Checking path: ${path.id} with ${path.challenges ? path.challenges.length : 0} challenges`);
      const found = path.challenges ? path.challenges.find(c => c.id === id) : null;
      if (found) {
        challenge = found;
        console.log('Challenge found:', challenge.title);
        break;
      }
    }
    
    if (!challenge) {
      console.log('Error: Challenge not found with ID:', id);
      return res.status(404).json({ error: 'Challenge not found' });
    }
    
    // Analyze the code and provide feedback
    console.log('Analyzing code for challenge:', challenge.title);
    const feedback = await analyzeCode(code, challenge);
    console.log('Feedback generated:', feedback ? 'success' : 'failure');
    
    // Update user progress if solution is correct
    if (feedback.score >= 70) {
      // Initialize user progress if it doesn't exist
      if (!userProgress[req.user.id]) {
        userProgress[req.user.id] = {
          userId: req.user.id,
          completedChallenges: [],
          strengths: [],
          weaknesses: [],
          recommendedPaths: [],
          lastActivity: new Date(),
          streakDays: 0,
          totalPoints: 0
        };
      }
      
      // Add challenge to completed challenges if not already completed
      if (!userProgress[req.user.id].completedChallenges.includes(id)) {
        userProgress[req.user.id].completedChallenges.push(id);
        userProgress[req.user.id].totalPoints += Math.floor(feedback.score);
        userProgress[req.user.id].lastActivity = new Date();
      }
    }
    
    res.json(feedback);
  } catch (error) {
    console.error('Error submitting challenge solution:', error);
    res.status(500).json({ error: 'Failed to submit solution' });
  }
});

/**
 * Get user progress
 * GET /api/learning/progress/:userId
 */
router.get('/learning/progress/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure users can only access their own progress
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get user progress from in-memory storage
    const progress = userProgress[userId];
    
    if (!progress) {
      return res.status(404).json({ error: 'User progress not found' });
    }
    
    res.json(progress);
  } catch (error) {
    console.error('Error getting user progress:', error);
    res.status(500).json({ error: 'Failed to get user progress' });
  }
});

/**
 * Save user progress
 * POST /api/learning/progress/:userId
 * Body: { UserProgress object }
 */
router.post('/learning/progress/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure users can only update their own progress
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const progress = req.body;
    
    // Validate progress data
    if (!progress) {
      return res.status(400).json({ error: 'Progress data is required' });
    }
    
    // Update progress in in-memory storage
    userProgress[userId] = {
      ...progress,
      lastUpdated: new Date()
    };
    
    res.status(200).json({ message: 'Progress saved successfully' });
  } catch (error) {
    console.error('Error saving user progress:', error);
    res.status(500).json({ error: 'Failed to save user progress' });
  }
});

/**
 * Get code suggestions
 * POST /api/learning/suggestions
 * Body: { code, language }
 */
router.post('/learning/suggestions', async (req, res) => {
  try {
    const { code, language } = req.body;
    
    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }
    
    // Generate code suggestions using AI
    const suggestions = await getCodeSuggestions(code, language);
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Error getting code suggestions:', error);
    res.status(500).json({ error: 'Failed to get code suggestions' });
  }
});

/**
 * Analyze code and provide feedback
 */
async function analyzeCode(code, challenge) {
  console.log('Starting code analysis for challenge:', challenge.id);
  
  // Basic code validation
  if (!code || code.trim().length === 0) {
    console.log('Empty code submission detected');
    return {
      score: 0,
      suggestions: ['Your solution is empty. Please write some code to solve the challenge.'],
      conceptsApplied: [],
      conceptsMissing: challenge.concepts,
      timeComplexity: 'N/A',
      spaceComplexity: 'N/A',
      readabilityScore: 0,
      bestPractices: {
        followed: [],
        missed: ['Code implementation']
      }
    };
  }
  
  console.log('Code validation passed, proceeding with analysis');

  // Check if code contains expected patterns based on the challenge
  const basicScore = calculateBasicScore(code, challenge);
  
  // If OpenRouter API key is available, use it for advanced analysis with DeepSeek V3
  if (OPENROUTER_API_KEY) {
    try {
      console.log('Using OpenRouter API with DeepSeek V3 for code analysis');
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'deepseek/deepseek-v3-0324',
          messages: [
            {
              role: 'system',
              content: `You are a code analysis expert. Analyze the following code solution for this challenge: ${challenge.title}. 
              The challenge description is: ${challenge.description}. 
              Provide feedback on correctness, efficiency, and style. Format your response as JSON with the following structure:
              {
                "score": number between 0-100,
                "suggestions": array of string suggestions,
                "conceptsApplied": array of strings,
                "conceptsMissing": array of strings,
                "timeComplexity": string,
                "spaceComplexity": string,
                "readabilityScore": number between 0-100,
                "bestPractices": {
                  "followed": array of strings,
                  "missed": array of strings
                }
              }`
            },
            {
              role: 'user',
              content: code
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://online-code-editor-mu-mauve.vercel.app/', // Replace with your site URL
            'X-Title': 'Online Compiler - AI Learning Companion',
            'Content-Type': 'application/json'
          }
        }
      );
      
      const content = response.data.choices[0].message.content;
      try {
        // Extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Error parsing AI response:', e);
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
    }
  }
  
  // Fallback: Simplified analysis without AI
  console.log('Using fallback analysis method');
  const fallbackResult = generateFallbackAnalysis(code, challenge, basicScore);
  console.log('Fallback analysis complete, returning result');
  return fallbackResult;
}

/**
 * Calculate a basic score based on pattern matching
 */
function calculateBasicScore(code, challenge) {
  let score = 50; // Start with a base score
  
  // Check if code contains expected keywords based on language
  const languagePatterns = {
    javascript: {
      keywords: ['function', 'return', 'const', 'let', 'var', 'if', 'for', 'while'],
      goodPractices: ['const', '=>', '===', '!=='],
      badPractices: ['==', '!=', 'var']
    },
    python: {
      keywords: ['def', 'return', 'if', 'for', 'while', 'import'],
      goodPractices: ['__main__', 'if __name__', 'with'],
      badPractices: ['exec', 'eval']
    },
    java: {
      keywords: ['class', 'public', 'private', 'static', 'void', 'return'],
      goodPractices: ['@Override', 'final', 'try', 'catch'],
      badPractices: ['System.exit', 'Thread.sleep']
    }
  };
  
  const patterns = languagePatterns[challenge.language] || languagePatterns.javascript;
  
  // Check for keywords
  patterns.keywords.forEach(keyword => {
    if (code.includes(keyword)) {
      score += 2;
    }
  });
  
  // Check for good practices
  patterns.goodPractices.forEach(practice => {
    if (code.includes(practice)) {
      score += 3;
    }
  });
  
  // Check for bad practices
  patterns.badPractices.forEach(practice => {
    if (code.includes(practice)) {
      score -= 2;
    }
  });
  
  // Check for concepts from the challenge
  challenge.concepts.forEach(concept => {
    // Simple pattern matching for concepts
    if (code.toLowerCase().includes(concept.toLowerCase())) {
      score += 5;
    }
  });
  
  // Adjust score based on code length (too short might be incomplete)
  if (code.length < 50) {
    score -= 10;
  }
  
  // Cap score between 40 and 95 (leaving room for AI to provide more accurate scoring)
  return Math.min(95, Math.max(40, score));
}

/**
 * Generate fallback analysis without using AI
 */
function generateFallbackAnalysis(code, challenge, basicScore) {
  // Determine which concepts might be applied based on simple pattern matching
  const conceptsApplied = [];
  const conceptsMissing = [];
  
  challenge.concepts.forEach(concept => {
    if (code.toLowerCase().includes(concept.toLowerCase())) {
      conceptsApplied.push(concept);
    } else {
      conceptsMissing.push(concept);
    }
  });
  
  // Generate custom suggestions based on the code and challenge
  const suggestions = [];
  
  // Add language-specific suggestions
  if (challenge.language === 'javascript') {
    if (!code.includes('const') && !code.includes('let')) {
      suggestions.push('Consider using const or let instead of var for better variable scoping.');
    }
    if (code.includes('==') || code.includes('!=')) {
      suggestions.push('Use === and !== instead of == and != to avoid type coercion issues.');
    }
  } else if (challenge.language === 'python') {
    if (!code.includes('def ')) {
      suggestions.push('Consider organizing your code into functions using the def keyword.');
    }
    if (code.includes('print') && !code.includes('__main__')) {
      suggestions.push('Consider using if __name__ == "__main__": for better script organization.');
    }
  }
  
  // Add general suggestions
  if (!code.includes('//') && !code.includes('/*') && !code.includes('#')) {
    suggestions.push('Add comments to explain your logic and make your code more readable.');
  }
  
  if (code.split('\n').length < 5) {
    suggestions.push('Consider breaking your solution into smaller, more manageable parts.');
  }
  
  // Ensure we have at least 3 suggestions
  const defaultSuggestions = [
    'Consider adding more comments to explain your logic.',
    'Try to use more descriptive variable names.',
    'Look for opportunities to refactor repeated code into functions.'
  ];
  
  while (suggestions.length < 3) {
    const suggestion = defaultSuggestions[suggestions.length];
    if (suggestion) {
      suggestions.push(suggestion);
    } else {
      break;
    }
  }
  
  // Calculate readability score based on comments, line length, and indentation
  let readabilityScore = 60; // Base score
  
  // Check for comments
  if (code.includes('//') || code.includes('/*') || code.includes('#')) {
    readabilityScore += 10;
  }
  
  // Check for reasonable line lengths
  const lines = code.split('\n');
  const longLines = lines.filter(line => line.length > 80).length;
  if (longLines === 0) {
    readabilityScore += 10;
  } else {
    readabilityScore -= longLines * 2;
  }
  
  // Check for consistent indentation
  const indentationPattern = lines.map(line => line.match(/^\s*/)[0].length);
  const uniqueIndentations = new Set(indentationPattern).size;
  if (uniqueIndentations <= 4) {
    readabilityScore += 10;
  } else {
    readabilityScore -= (uniqueIndentations - 4) * 5;
  }
  
  // Cap readability score
  readabilityScore = Math.min(100, Math.max(0, readabilityScore));
  
  return {
    score: basicScore,
    suggestions,
    conceptsApplied,
    conceptsMissing,
    timeComplexity: estimateTimeComplexity(code),
    spaceComplexity: estimateSpaceComplexity(code),
    readabilityScore,
    bestPractices: {
      followed: generateFollowedPractices(code, challenge.language),
      missed: generateMissedPractices(code, challenge.language)
    }
  };
}

/**
 * Estimate time complexity based on code patterns
 */
function estimateTimeComplexity(code) {
  if (code.includes('for') && code.includes('for') && code.match(/for.*for/s)) {
    return 'O(n²)'; // Nested loops suggest quadratic complexity
  } else if (code.includes('for') || code.includes('while') || code.includes('forEach') || code.includes('map')) {
    return 'O(n)'; // Single loop suggests linear complexity
  } else {
    return 'O(1)'; // No loops suggest constant complexity
  }
}

/**
 * Estimate space complexity based on code patterns
 */
function estimateSpaceComplexity(code) {
  if (code.includes('new Array') || code.includes('[]') || code.includes('new Map') || 
      code.includes('new Set') || code.includes('{}')) {
    if (code.includes('for') && (code.includes('push') || code.includes('append'))) {
      return 'O(n)'; // Creating and filling data structures suggests linear space
    }
  }
  return 'O(1)'; // Default to constant space
}

/**
 * Generate list of followed best practices
 */
function generateFollowedPractices(code, language) {
  const practices = [];
  
  // Check for common good practices
  if (code.includes('//') || code.includes('/*') || code.includes('#')) {
    practices.push('Code includes comments');
  }
  
  if (code.split('\n').length > 3) {
    practices.push('Code is organized into multiple lines');
  }
  
  // Language-specific practices
  if (language === 'javascript') {
    if (code.includes('const') || code.includes('let')) {
      practices.push('Uses modern variable declarations (const/let)');
    }
    if (code.includes('=>')) {
      practices.push('Uses arrow functions');
    }
  } else if (language === 'python') {
    if (code.includes('def ')) {
      practices.push('Uses function definitions');
    }
  }
  
  // Add default practices if none detected
  if (practices.length === 0) {
    practices.push('Proper indentation');
    practices.push('Consistent naming convention');
  }
  
  return practices;
}

/**
 * Generate list of missed best practices
 */
function generateMissedPractices(code, language) {
  const practices = [];
  
  // Check for common missed practices
  if (!code.includes('//') && !code.includes('/*') && !code.includes('#')) {
    practices.push('Missing comments');
  }
  
  // Language-specific missed practices
  if (language === 'javascript') {
    if (code.includes('var')) {
      practices.push('Uses var instead of const/let');
    }
    if (code.includes('==') || code.includes('!=')) {
      practices.push('Uses loose equality operators (== or !=)');
    }
  } else if (language === 'python') {
    if (!code.includes('def ') && code.length > 100) {
      practices.push('Code not organized into functions');
    }
  }
  
  // Add default practices if none detected
  if (practices.length === 0) {
    practices.push('Could improve variable naming');
    practices.push('Could add more documentation');
  }
  
  return practices;
}

/**
 * Generate code suggestions using AI or fallback to predefined suggestions
 */
async function getCodeSuggestions(code, language) {
  // Normalize language to lowercase for consistency
  const normalizedLanguage = language.toLowerCase();
  
  // Only attempt API call if we have a key and the language is supported
  if (OPENROUTER_API_KEY && ['python', 'javascript', 'java', 'html'].includes(normalizedLanguage)) {
    try {
      console.log(`Attempting to get AI suggestions for ${normalizedLanguage} code`);
      
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'deepseek/deepseek-v3-0324',
          messages: [
            {
              role: 'system',
              content: `You are a coding assistant for beginners. The user is learning ${normalizedLanguage}. 
              Provide 3 specific, actionable suggestions to improve their code. 
              Each suggestion should be concise (max 100 characters) and focus on a different aspect 
              (e.g., readability, efficiency, best practices).`
            },
            {
              role: 'user',
              content: code
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://online-code-editor-mu-mauve.vercel.app/',
            'X-Title': 'Online Compiler - AI Learning Companion',
            'Content-Type': 'application/json'
          },
          timeout: 5000 // 5 second timeout to prevent long waits
        }
      );
      
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const content = response.data.choices[0].message.content;
        // Extract suggestions (one per line)
        const aiSuggestions = content.split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^\d+\.\s*/, '').trim()) // Remove numbering if present
          .slice(0, 3);
          
        console.log('Successfully generated AI suggestions');
        return aiSuggestions;
      }
    } catch (error) {
      console.error('Error calling OpenAI API for suggestions:', error);
      // Continue to fallback suggestions
    }
  }
  
  // Fallback: Generic suggestions based on language
  const suggestions = {
    javascript: [
      'Consider using const for variables that don\'t change.',
      'Try using array methods like map() or filter() for cleaner code.',
      'Add descriptive comments to explain complex logic.'
    ],
    python: [
      'Use list comprehensions for more concise code.',
      'Follow PEP 8 style guidelines for better readability.',
      'Consider adding type hints to make your code more robust.'
    ],
    java: [
      'Follow Java naming conventions for methods and variables.',
      'Consider using enhanced for loops for array iteration.',
      'Group related functionality into separate methods.'
    ],
    cpp: [
      'Use references instead of pointers when possible.',
      'Consider using auto for complex type declarations.',
      'Prefer standard library containers over raw arrays.'
    ]
  };
  
  return suggestions[language.toLowerCase()] || [
    'Add comments to explain your logic.',
    'Use descriptive variable names.',
    'Break complex operations into smaller functions.'
  ];
}

/**
 * Get sample learning paths for demo purposes
 */
function getSampleLearningPaths() {
  return [
    {
      id: 'py-fundamentals',
      title: 'Python Fundamentals',
      description: 'Learn Python programming fundamentals with hands-on exercises and challenges.',
      language: 'python',
      level: 'beginner',
      prerequisites: [],
      estimatedHours: 20,
      concepts: ['variables', 'data types', 'functions', 'conditionals', 'loops', 'lists', 'dictionaries', 'file handling', 'error handling', 'modules'],
      badgeUrl: 'https://img.shields.io/badge/Python-Fundamentals-blue',
      challenges: [
        {
          id: 'py-hello-world',
          title: 'Hello, Python!',
          description: 'Write your first Python program to print a greeting.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Print "Hello, Python!" to the console\n\n# Your code here\n',
          solutionCode: 'print("Hello, Python!")',
          testCases: [
            {
              input: '',
              expectedOutput: 'Hello, Python!',
              isHidden: false,
              explanation: 'Your code should output "Hello, Python!" to the console.'
            }
          ],
          hints: [
            'Use the print() function to output text.',
            'Strings in Python can use single or double quotes.'
          ],
          concepts: ['print function', 'strings'],
          timeEstimate: 5
        },
        {
          id: 'py-lists',
          title: 'Working with Lists',
          description: 'Learn how to create and manipulate lists in Python.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a list of fruits with at least 3 items\n# Then add a new fruit to the list\n# Finally, print the list\n\n# Your code here\n',
          solutionCode: 'fruits = ["apple", "banana", "orange"]\nfruits.append("grape")\nprint(fruits)',
          testCases: [
            {
              input: '',
              expectedOutput: '',
              isHidden: false,
              explanation: 'Your code should create a list, add an item, and print the result.'
            }
          ],
          hints: [
            'Create a list using square brackets [].',
            'Separate list items with commas.',
            'Use the append() method to add an item to a list.',
            'Use print() to display the list.'
          ],
          concepts: ['lists', 'methods', 'print function'],
          timeEstimate: 10
        }
      ]
    },
    {
      id: 'py-data-structures',
      title: 'Python Data Structures',
      description: 'Learn essential data structures and algorithms with Python.',
      language: 'python',
      level: 'intermediate',
      prerequisites: ['py-basics'],
      estimatedHours: 12,
      concepts: ['lists', 'dictionaries', 'sets', 'tuples', 'algorithms', 'sorting', 'searching'],
      badgeUrl: 'https://img.shields.io/badge/Python-Data_Structures-blue',
      challenges: [
        {
          id: 'py-list-operations',
          title: 'List Operations',
          description: 'Practice common list operations in Python.',
          difficulty: 'intermediate',
          language: 'python',
          starterCode: '# Create a function that finds the second largest number in a list\n# Example: find_second_largest([5, 2, 8, 1, 9]) should return 8\n\ndef find_second_largest(numbers):\n    # Your code here\n    pass\n\n# Test your function\nprint(find_second_largest([5, 2, 8, 1, 9]))\n',
          solutionCode: 'def find_second_largest(numbers):\n    if len(numbers) < 2:\n        return None\n    # Sort the list in descending order\n    sorted_numbers = sorted(numbers, reverse=True)\n    # Return the second element\n    return sorted_numbers[1]\n\n# Test your function\nprint(find_second_largest([5, 2, 8, 1, 9]))\n',
          testCases: [
            {
              input: '[5, 2, 8, 1, 9]',
              expectedOutput: '8',
              isHidden: false,
              explanation: 'The largest number is 9, so the second largest is 8.'
            },
            {
              input: '[3, 3, 3]',
              expectedOutput: '3',
              isHidden: true,
              explanation: 'When there are duplicates, the second largest is the same as the largest.'
            }
          ],
          hints: [
            'Consider sorting the list first.',
            'Remember to handle edge cases like empty lists or lists with only one element.',
            'What if there are duplicate values in the list?'
          ],
          concepts: ['lists', 'sorting', 'algorithms'],
          timeEstimate: 15
        },
        {
          id: 'py-dictionary-usage',
          title: 'Dictionary Usage',
          description: 'Learn how to use dictionaries for efficient data lookup.',
          difficulty: 'intermediate',
          language: 'python',
          starterCode: '# Create a function that counts the frequency of each word in a string\n# Example: word_frequency("hello world hello") should return {"hello": 2, "world": 1}\n\ndef word_frequency(text):\n    # Your code here\n    pass\n\n# Test your function\nprint(word_frequency("hello world hello"))\n',
          solutionCode: 'def word_frequency(text):\n    words = text.lower().split()\n    frequency = {}\n    \n    for word in words:\n        if word in frequency:\n            frequency[word] += 1\n        else:\n            frequency[word] = 1\n            \n    return frequency\n\n# Test your function\nprint(word_frequency("hello world hello"))\n',
          testCases: [
            {
              input: '"hello world hello"',
              expectedOutput: '{"hello": 2, "world": 1}',
              isHidden: false,
              explanation: 'The word "hello" appears twice and "world" appears once.'
            }
          ],
          hints: [
            'Split the string into words using the split() method.',
            'Use a dictionary to keep track of word counts.',
            'Consider converting all words to lowercase for case-insensitive counting.'
          ],
          concepts: ['dictionaries', 'strings', 'loops'],
          timeEstimate: 20
        }
      ]
    }
  ];
}

export default router;
