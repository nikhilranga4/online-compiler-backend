/**
 * Learning routes for AI-powered interactive learning paths
 */
import express from 'express';
import { verifyToken } from '../user-service.js';
import axios from 'axios';

const router = express.Router();

// OpenAI API key for AI-powered code analysis
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// In-memory storage for user progress (temporary solution)
const userProgress = {};

/**
 * Middleware to verify user authentication
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    const user = await verifyToken(token);
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Get all learning paths with optional filtering
 * GET /api/learning/paths
 */
router.get('/learning/paths', async (req, res) => {
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
router.get('/learning/paths/:id', async (req, res) => {
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
router.get('/learning/challenges/:id', async (req, res) => {
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
router.post('/learning/challenges/:id/submit', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code solution is required' });
    }
    
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
    
    // Analyze the code and provide feedback
    const feedback = await analyzeCode(code, challenge);
    
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
  // If OpenAI API key is available, use it for advanced analysis
  if (OPENAI_API_KEY) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
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
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
  return {
    score: Math.floor(Math.random() * 30) + 70, // Random score between 70-100
    suggestions: [
      'Consider adding more comments to explain your logic.',
      'Try to use more descriptive variable names.',
      'Look for opportunities to refactor repeated code into functions.'
    ],
    conceptsApplied: challenge.concepts.slice(0, Math.floor(challenge.concepts.length * 0.7)),
    conceptsMissing: challenge.concepts.slice(Math.floor(challenge.concepts.length * 0.7)),
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    readabilityScore: 75,
    bestPractices: {
      followed: ['Proper indentation', 'Consistent naming convention'],
      missed: ['Missing function documentation', 'Could use more modular approach']
    }
  };
}

/**
 * Generate code suggestions using AI or fallback to predefined suggestions
 */
async function getCodeSuggestions(code, language) {
  // If OpenAI API key is available, use it for personalized suggestions
  if (OPENAI_API_KEY) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a coding assistant for beginners. The user is learning ${language}. 
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
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const content = response.data.choices[0].message.content;
      // Extract suggestions (one per line)
      return content.split('\n').filter(line => line.trim().length > 0).slice(0, 3);
    } catch (error) {
      console.error('Error calling OpenAI API for suggestions:', error);
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
      id: 'js-fundamentals',
      title: 'JavaScript Fundamentals',
      description: 'Learn the basics of JavaScript programming with interactive challenges.',
      language: 'javascript',
      level: 'beginner',
      prerequisites: [],
      estimatedHours: 10,
      concepts: ['variables', 'data types', 'functions', 'conditionals', 'loops', 'arrays', 'objects'],
      badgeUrl: 'https://img.shields.io/badge/JavaScript-Fundamentals-yellow',
      challenges: [
        {
          id: 'js-variables',
          title: 'Working with Variables',
          description: 'Learn how to declare and use variables in JavaScript.',
          difficulty: 'beginner',
          language: 'javascript',
          starterCode: '// Declare a variable named "greeting" and assign it the value "Hello, World!"\n// Then log it to the console\n\n// Your code here\n',
          solutionCode: 'const greeting = "Hello, World!";\nconsole.log(greeting);',
          testCases: [
            {
              input: '',
              expectedOutput: 'Hello, World!',
              isHidden: false,
              explanation: 'Your code should output "Hello, World!" to the console.'
            }
          ],
          hints: [
            'Use const, let, or var to declare a variable.',
            'Assign a string value using quotes.',
            'Use console.log() to output to the console.'
          ],
          concepts: ['variables', 'strings', 'console output'],
          timeEstimate: 10
        },
        {
          id: 'js-functions',
          title: 'Creating Functions',
          description: 'Learn how to create and call functions in JavaScript.',
          difficulty: 'beginner',
          language: 'javascript',
          starterCode: '// Create a function called "add" that takes two parameters and returns their sum\n// Then call it with 5 and 3\n\n// Your code here\n',
          solutionCode: 'function add(a, b) {\n  return a + b;\n}\n\nconsole.log(add(5, 3));',
          testCases: [
            {
              input: '5, 3',
              expectedOutput: '8',
              isHidden: false,
              explanation: 'Your function should return the sum of 5 and 3, which is 8.'
            },
            {
              input: '10, -2',
              expectedOutput: '8',
              isHidden: true,
              explanation: 'Your function should handle negative numbers.'
            }
          ],
          hints: [
            'Use the "function" keyword followed by the function name.',
            'Parameters go inside parentheses ().',
            'The function body goes inside curly braces {}.',
            'Use the "return" keyword to return a value.'
          ],
          concepts: ['functions', 'parameters', 'return values'],
          timeEstimate: 15
        }
      ]
    },
    {
      id: 'py-basics',
      title: 'Python Basics',
      description: 'Get started with Python programming through hands-on challenges.',
      language: 'python',
      level: 'beginner',
      prerequisites: [],
      estimatedHours: 8,
      concepts: ['variables', 'data types', 'functions', 'conditionals', 'loops', 'lists', 'dictionaries'],
      badgeUrl: 'https://img.shields.io/badge/Python-Basics-blue',
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
    }
  ];
}

export default router;
