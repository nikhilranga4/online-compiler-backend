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
      id: 'python-fundamentals',
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
          title: '1. Hello World',
          description: 'Write your first Python program to print a message to the console.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Write a program that prints "Hello, Python!" to the console\n\n',
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
            'Use the print() function',
            'Strings must be enclosed in quotes'
          ],
          concepts: ['print', 'strings'],
          timeEstimate: 3
        },
        {
          id: 'py-variables',
          title: '2. Variables and Input',
          description: 'Learn how to use variables and get user input in Python.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a program that asks for the user\'s name and then greets them\n# Example: If the user enters "Alice", it should print "Hello, Alice!"\n\n',
          solutionCode: 'name = input("Enter your name: ")\nprint(f"Hello, {name}!")',
          testCases: [
            {
              input: 'Alice',
              expectedOutput: 'Hello, Alice!',
              isHidden: false,
              explanation: 'Your code should ask for a name and then greet the user.'
            }
          ],
          hints: [
            'Use input() to get user input',
            'Use variables to store the input',
            'Use f-strings for formatted output'
          ],
          concepts: ['variables', 'input', 'f-strings'],
          timeEstimate: 5
        },
        {
          id: 'py-numbers',
          title: '3. Working with Numbers',
          description: 'Learn how to perform basic arithmetic operations in Python.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a program that calculates the area of a rectangle\n# Ask the user for the width and height, then print the area\n\n',
          solutionCode: 'width = float(input("Enter the width: "))\nheight = float(input("Enter the height: "))\narea = width * height\nprint(f"The area of the rectangle is {area} square units")',
          testCases: [
            {
              input: '5\n10',
              expectedOutput: 'The area of the rectangle is 50.0 square units',
              isHidden: false,
              explanation: 'Your code should calculate the area of a rectangle with width 5 and height 10.'
            }
          ],
          hints: [
            'Convert input to float using float()',
            'Calculate area by multiplying width and height',
            'Use f-strings to display the result'
          ],
          concepts: ['arithmetic', 'type conversion', 'variables'],
          timeEstimate: 7
        },
        {
          id: 'py-conditionals',
          title: '4. Conditional Statements',
          description: 'Learn how to use if-else statements to make decisions in your code.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a program that checks if a number is positive, negative, or zero\n# Ask the user for a number and print the result\n\n',
          solutionCode: 'number = float(input("Enter a number: "))\n\nif number > 0:\n    print("The number is positive")\nelif number < 0:\n    print("The number is negative")\nelse:\n    print("The number is zero")',
          testCases: [
            {
              input: '42',
              expectedOutput: 'The number is positive',
              isHidden: false,
              explanation: 'Your code should identify that 42 is a positive number.'
            },
            {
              input: '-7',
              expectedOutput: 'The number is negative',
              isHidden: true,
              explanation: 'Your code should identify that -7 is a negative number.'
            }
          ],
          hints: [
            'Use if, elif, and else for different conditions',
            'Compare the number with 0',
            'Make sure to convert the input to a number'
          ],
          concepts: ['conditionals', 'comparison operators'],
          timeEstimate: 8
        },
        {
          id: 'py-loops-1',
          title: '5. For Loops',
          description: 'Learn how to use for loops to repeat actions in Python.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a program that prints the multiplication table for a number\n# Ask the user for a number, then print its multiplication table from 1 to 10\n\n',
          solutionCode: 'number = int(input("Enter a number: "))\n\nfor i in range(1, 11):\n    result = number * i\n    print(f"{number} x {i} = {result}")',
          testCases: [
            {
              input: '7',
              expectedOutput: '7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21\n7 x 4 = 28\n7 x 5 = 35\n7 x 6 = 42\n7 x 7 = 49\n7 x 8 = 56\n7 x 9 = 63\n7 x 10 = 70',
              isHidden: false,
              explanation: 'Your code should print the multiplication table for 7 from 1 to 10.'
            }
          ],
          hints: [
            'Use range(1, 11) to iterate from 1 to 10',
            'Calculate the product inside the loop',
            'Use f-strings to format the output'
          ],
          concepts: ['loops', 'range', 'multiplication'],
          timeEstimate: 8
        },
        {
          id: 'py-loops-2',
          title: '6. While Loops',
          description: 'Learn how to use while loops for conditional repetition.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a countdown program\n# Ask the user for a starting number, then count down to 0\n\n',
          solutionCode: 'count = int(input("Enter a starting number: "))\n\nwhile count >= 0:\n    print(count)\n    count -= 1\n\nprint("Blast off!")',
          testCases: [
            {
              input: '3',
              expectedOutput: '3\n2\n1\n0\nBlast off!',
              isHidden: false,
              explanation: 'Your code should count down from 3 to 0 and then print "Blast off!"'
            }
          ],
          hints: [
            'Use a while loop that continues as long as count >= 0',
            'Decrement the counter in each iteration with count -= 1',
            'Print a message after the loop ends'
          ],
          concepts: ['while loops', 'decrement operators'],
          timeEstimate: 7
        },
        {
          id: 'py-lists-1',
          title: '7. Lists Basics',
          description: 'Learn how to create and manipulate lists in Python.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a program that builds a shopping list\n# Ask the user to enter 5 items, add them to a list, and then print the list\n\n',
          solutionCode: 'shopping_list = []\n\nfor i in range(5):\n    item = input(f"Enter item {i+1}: ")\n    shopping_list.append(item)\n\nprint("Your shopping list:")\nfor item in shopping_list:\n    print(f"- {item}")',
          testCases: [
            {
              input: 'apples\nbananas\nmilk\nbread\neggs',
              expectedOutput: 'Your shopping list:\n- apples\n- bananas\n- milk\n- bread\n- eggs',
              isHidden: false,
              explanation: 'Your code should create a shopping list with the 5 items entered by the user.'
            }
          ],
          hints: [
            'Create an empty list with shopping_list = []',
            'Use append() to add items to the list',
            'Use a loop to ask for each item',
            'Use another loop to print each item'
          ],
          concepts: ['lists', 'append', 'loops'],
          timeEstimate: 10
        },
        {
          id: 'py-lists-2',
          title: '8. List Operations',
          description: 'Learn how to perform various operations on lists.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a program that finds the maximum, minimum, and average of a list of numbers\n# Use this list: [12, 45, 78, 34, 56, 23, 89, 10]\n\n',
          solutionCode: 'numbers = [12, 45, 78, 34, 56, 23, 89, 10]\n\nmaximum = max(numbers)\nminimum = min(numbers)\naverage = sum(numbers) / len(numbers)\n\nprint(f"Maximum: {maximum}")\nprint(f"Minimum: {minimum}")\nprint(f"Average: {average:.2f}")',
          testCases: [
            {
              input: '',
              expectedOutput: 'Maximum: 89\nMinimum: 10\nAverage: 43.38',
              isHidden: false,
              explanation: 'Your code should find the maximum, minimum, and average of the given list.'
            }
          ],
          hints: [
            'Use max() to find the maximum value',
            'Use min() to find the minimum value',
            'Use sum() and len() to calculate the average',
            'Format the average to 2 decimal places with :.2f'
          ],
          concepts: ['lists', 'built-in functions', 'formatting'],
          timeEstimate: 8
        },
        {
          id: 'py-functions-1',
          title: '9. Basic Functions',
          description: 'Learn how to define and call functions in Python.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a function called greet that takes a name as a parameter and prints a greeting\n# Then call the function with different names\n\n',
          solutionCode: 'def greet(name):\n    print(f"Hello, {name}! Welcome to Python programming.")\n\ngreet("Alice")\ngreet("Bob")\ngreet("Charlie")',
          testCases: [
            {
              input: '',
              expectedOutput: 'Hello, Alice! Welcome to Python programming.\nHello, Bob! Welcome to Python programming.\nHello, Charlie! Welcome to Python programming.',
              isHidden: false,
              explanation: 'Your code should define a function that greets a person by name and call it with three different names.'
            }
          ],
          hints: [
            'Define a function using the def keyword',
            'Add a parameter in the parentheses',
            'Use f-strings to include the parameter in the output',
            'Call the function with different arguments'
          ],
          concepts: ['functions', 'parameters', 'function calls'],
          timeEstimate: 7
        },
        {
          id: 'py-functions-2',
          title: '10. Functions with Return Values',
          description: 'Learn how to create functions that return values.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a function called calculate_area that calculates the area of a rectangle\n# The function should take width and height as parameters and return the area\n# Test the function with different values\n\n',
          solutionCode: 'def calculate_area(width, height):\n    area = width * height\n    return area\n\n# Test the function\nprint(f"Area of rectangle with width 5 and height 10: {calculate_area(5, 10)}")\nprint(f"Area of rectangle with width 3 and height 4: {calculate_area(3, 4)}")\nprint(f"Area of square with side 6: {calculate_area(6, 6)}")',
          testCases: [
            {
              input: '',
              expectedOutput: 'Area of rectangle with width 5 and height 10: 50\nArea of rectangle with width 3 and height 4: 12\nArea of square with side 6: 36',
              isHidden: false,
              explanation: 'Your code should define a function that calculates the area of a rectangle and call it with different values.'
            }
          ],
          hints: [
            'Define a function with two parameters',
            'Calculate the area inside the function',
            'Use the return keyword to return the result',
            'Call the function and use the returned value in print statements'
          ],
          concepts: ['functions', 'return values', 'parameters'],
          timeEstimate: 8
        },
        {
          id: 'py-dictionaries',
          title: '11. Dictionaries',
          description: 'Learn how to use dictionaries to store key-value pairs in Python.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a program that stores information about a person in a dictionary\n# Include name, age, city, and favorite programming language\n# Then print each piece of information\n\n',
          solutionCode: 'person = {\n    "name": "John Doe",\n    "age": 25,\n    "city": "San Francisco",\n    "language": "Python"\n}\n\nprint(f"Name: {person["name"]}\nAge: {person["age"]}\nCity: {person["city"]}\nFavorite Language: {person["language"]}")',
          testCases: [
            {
              input: '',
              expectedOutput: 'Name: John Doe\nAge: 25\nCity: San Francisco\nFavorite Language: Python',
              isHidden: false,
              explanation: 'Your code should create a dictionary with person information and print each value.'
            }
          ],
          hints: [
            'Create a dictionary using curly braces {}',
            'Use key-value pairs separated by colons',
            'Access values using square brackets and the key',
            'Use f-strings to format the output'
          ],
          concepts: ['dictionaries', 'key-value pairs'],
          timeEstimate: 8
        },
        {
          id: 'py-string-methods',
          title: '12. String Methods',
          description: 'Learn how to manipulate strings using built-in string methods.',
          difficulty: 'beginner',
          language: 'python',
          starterCode: '# Create a program that manipulates a string in various ways\n# Ask the user for a sentence, then:\n# 1. Print the sentence in uppercase\n# 2. Print the sentence in lowercase\n# 3. Print the number of characters in the sentence\n# 4. Print the sentence with all "a" characters replaced with "*"\n\n',
          solutionCode: 'sentence = input("Enter a sentence: ")\n\nprint(f"Uppercase: {sentence.upper()}")\nprint(f"Lowercase: {sentence.lower()}")\nprint(f"Length: {len(sentence)} characters")\nprint(f"Replaced: {sentence.replace("a", "*")}")',
          testCases: [
            {
              input: 'Python is amazing',
              expectedOutput: 'Uppercase: PYTHON IS AMAZING\nLowercase: python is amazing\nLength: 17 characters\nReplaced: Python is *m*zing',
              isHidden: false,
              explanation: 'Your code should perform various string operations on the input.'
            }
          ],
          hints: [
            'Use upper() to convert to uppercase',
            'Use lower() to convert to lowercase',
            'Use len() to get the length',
            'Use replace() to replace characters'
          ],
          concepts: ['string methods', 'string manipulation'],
          timeEstimate: 7
        },
        {
          id: 'py-error-handling',
          title: '13. Error Handling',
          description: 'Learn how to handle exceptions and errors in Python.',
          difficulty: 'intermediate',
          language: 'python',
          starterCode: '# Create a program that safely converts user input to a number\n# If the user enters something that\'s not a number, handle the error\n# and ask them to try again\n\n',
          solutionCode: 'while True:\n    try:\n        number = float(input("Enter a number: "))\n        print(f"You entered: {number}")\n        break  # Exit the loop if successful\n    except ValueError:\n        print("That\'s not a valid number. Please try again.")',
          testCases: [
            {
              input: 'abc\n42',
              expectedOutput: 'That\'s not a valid number. Please try again.\nYou entered: 42.0',
              isHidden: false,
              explanation: 'Your code should handle invalid input and keep asking until a valid number is entered.'
            }
          ],
          hints: [
            'Use a try-except block to catch errors',
            'Put the code that might cause an error in the try block',
            'Handle the ValueError exception',
            'Use a while loop to keep asking until valid input is received'
          ],
          concepts: ['error handling', 'exceptions', 'try-except'],
          timeEstimate: 10
        },
        {
          id: 'py-file-read',
          title: '14. Reading Files',
          description: 'Learn how to read data from files in Python.',
          difficulty: 'intermediate',
          language: 'python',
          starterCode: '# Create a program that reads and displays the contents of a file\n# For this exercise, let\'s create a sample file content in a string variable\n# and then write code to process it as if it were read from a file\n\nfile_content = """Line 1: Python is awesome\nLine 2: File handling is important\nLine 3: This is a sample file\nLine 4: Learning is fun\nLine 5: Practice makes perfect"""\n\n# Now write code to process this content as if you read it from a file\n# Count the number of lines and print each line with its line number\n\n',
          solutionCode: 'file_content = """Line 1: Python is awesome\nLine 2: File handling is important\nLine 3: This is a sample file\nLine 4: Learning is fun\nLine 5: Practice makes perfect"""\n\n# Split the content into lines\nlines = file_content.split("\n")\n\n# Count the number of lines\nline_count = len(lines)\nprint(f"The file contains {line_count} lines.\n")\n\n# Print each line with its line number\nfor i, line in enumerate(lines, 1):\n    print(f"Line {i}: {line}")',
          testCases: [
            {
              input: '',
              expectedOutput: 'The file contains 5 lines.\n\nLine 1: Line 1: Python is awesome\nLine 2: Line 2: File handling is important\nLine 3: Line 3: This is a sample file\nLine 4: Line 4: Learning is fun\nLine 5: Line 5: Practice makes perfect',
              isHidden: false,
              explanation: 'Your code should count and display the lines in the file content.'
            }
          ],
          hints: [
            'Use split("\n") to divide the content into lines',
            'Use len() to count the number of lines',
            'Use enumerate() to get both the index and value in a loop',
            'Pass 1 as the second argument to enumerate() to start counting from 1'
          ],
          concepts: ['file handling', 'string methods', 'enumerate'],
          timeEstimate: 10
        },
        {
          id: 'py-list-comprehension',
          title: '15. List Comprehensions',
          description: 'Learn how to use list comprehensions for concise list creation.',
          difficulty: 'intermediate',
          language: 'python',
          starterCode: '# Create a program that uses list comprehensions to:\n# 1. Create a list of squares of numbers from 1 to 10\n# 2. Create a list of even numbers from 1 to 20\n# 3. Create a list of strings that are longer than 5 characters from a given list\n\nwords = ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape"]\n\n',
          solutionCode: '# List of squares from 1 to 10\nsquares = [x**2 for x in range(1, 11)]\nprint(f"Squares: {squares}")\n\n# List of even numbers from 1 to 20\neven_numbers = [x for x in range(1, 21) if x % 2 == 0]\nprint(f"Even numbers: {even_numbers}")\n\n# List of words longer than 5 characters\nwords = ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape"]\nlong_words = [word for word in words if len(word) > 5]\nprint(f"Long words: {long_words}")',
          testCases: [
            {
              input: '',
              expectedOutput: 'Squares: [1, 4, 9, 16, 25, 36, 49, 64, 81, 100]\nEven numbers: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]\nLong words: ["banana", "elderberry"]',
              isHidden: false,
              explanation: 'Your code should create three different lists using list comprehensions.'
            }
          ],
          hints: [
            'Use [expression for item in iterable] syntax',
            'Add conditions with [expression for item in iterable if condition]',
            'Use x**2 for squares',
            'Use x % 2 == 0 to check for even numbers',
            'Use len(word) > 5 to check word length'
          ],
          concepts: ['list comprehensions', 'conditionals', 'iteration'],
          timeEstimate: 12
        },
        {
          id: 'py-functions-advanced',
          title: '16. Advanced Functions',
          description: 'Learn about default parameters, keyword arguments, and *args/**kwargs.',
          difficulty: 'intermediate',
          language: 'python',
          starterCode: '# Create a function called print_info that can accept any number of arguments\n# The function should have parameters for name and age with default values\n# It should also accept additional keyword arguments\n# Print all the information in a formatted way\n\n',
          solutionCode: 'def print_info(name="Unknown", age=0, *args, **kwargs):\n    print(f"Name: {name}")\n    print(f"Age: {age}")\n    \n    if args:\n        print("Additional information:")\n        for arg in args:\n            print(f"- {arg}")\n    \n    if kwargs:\n        print("Key details:")\n        for key, value in kwargs.items():\n            print(f"- {key}: {value}")\n\n# Test the function with different arguments\nprint_info()  # Using defaults\nprint("---")\nprint_info("Alice", 30)  # Positional arguments\nprint("---")\nprint_info("Bob", 25, "Developer", "Python Expert")  # With additional args\nprint("---")\nprint_info("Charlie", 35, job="Data Scientist", city="New York")  # With kwargs',
          testCases: [
            {
              input: '',
              expectedOutput: 'Name: Unknown\nAge: 0\n---\nName: Alice\nAge: 30\n---\nName: Bob\nAge: 25\nAdditional information:\n- Developer\n- Python Expert\n---\nName: Charlie\nAge: 35\nKey details:\n- job: Data Scientist\n- city: New York',
              isHidden: false,
              explanation: 'Your code should define a function that handles default parameters, *args, and **kwargs.'
            }
          ],
          hints: [
            'Use default parameter values with name="Unknown", age=0',
            'Use *args to collect additional positional arguments',
            'Use **kwargs to collect additional keyword arguments',
            'Iterate through args and kwargs.items() to display all values'
          ],
          concepts: ['default parameters', 'args', 'kwargs', 'function parameters'],
          timeEstimate: 15
        },
        {
          id: 'py-classes',
          title: '17. Classes and Objects',
          description: 'Learn how to create and use classes in Python.',
          difficulty: 'intermediate',
          language: 'python',
          starterCode: '# Create a class called Rectangle with:\n# - Attributes for width and height\n# - Methods to calculate area and perimeter\n# - A method to display information about the rectangle\n# Then create some rectangle objects and test the methods\n\n',
          solutionCode: 'class Rectangle:\n    def __init__(self, width, height):\n        self.width = width\n        self.height = height\n    \n    def calculate_area(self):\n        return self.width * self.height\n    \n    def calculate_perimeter(self):\n        return 2 * (self.width + self.height)\n    \n    def display_info(self):\n        print(f"Rectangle: {self.width} x {self.height}")\n        print(f"Area: {self.calculate_area()}")\n        print(f"Perimeter: {self.calculate_perimeter()}")\n\n# Create rectangle objects\nrect1 = Rectangle(5, 10)\nrect2 = Rectangle(3, 4)\n\n# Test methods\nrect1.display_info()\nprint("---")\nrect2.display_info()',
          testCases: [
            {
              input: '',
              expectedOutput: 'Rectangle: 5 x 10\nArea: 50\nPerimeter: 30\n---\nRectangle: 3 x 4\nArea: 12\nPerimeter: 14',
              isHidden: false,
              explanation: 'Your code should define a Rectangle class with methods for area, perimeter, and display.'
            }
          ],
          hints: [
            'Define a class with the class keyword',
            'Use __init__ for the constructor',
            'Use self to refer to the instance',
            'Create methods that operate on the instance attributes',
            'Create objects with ClassName(arguments)'
          ],
          concepts: ['classes', 'objects', 'methods', 'attributes'],
          timeEstimate: 15
        },
        {
          id: 'py-modules',
          title: '18. Modules and Imports',
          description: 'Learn how to use built-in modules in Python.',
          difficulty: 'intermediate',
          language: 'python',
          starterCode: '# Create a program that uses various built-in modules:\n# - math: Calculate square root and pi\n# - random: Generate random numbers\n# - datetime: Display current date and time\n# - sys: Show Python version\n\n',
          solutionCode: 'import math\nimport random\nimport datetime\nimport sys\n\n# Using math module\nprint(f"Square root of 16: {math.sqrt(16)}")\nprint(f"Value of pi: {math.pi}")\n\n# Using random module\nprint(f"Random number between 1 and 10: {random.randint(1, 10)}")\nprint(f"Random choice from list: {random.choice(["apple", "banana", "cherry"])}")\n\n# Using datetime module\nnow = datetime.datetime.now()\nprint(f"Current date and time: {now.strftime("%Y-%m-%d %H:%M:%S")}")\n\n# Using sys module\nprint(f"Python version: {sys.version}")',
          testCases: [
            {
              input: '',
              expectedOutput: '',
              isHidden: false,
              explanation: 'Your code should use various built-in modules to perform different operations.'
            }
          ],
          hints: [
            'Use import statements at the top of the file',
            'Access module functions with module_name.function_name()',
            'Use math.sqrt() for square root',
            'Use random.randint() for random integers',
            'Use datetime.datetime.now() for current time',
            'Use sys.version for Python version'
          ],
          concepts: ['modules', 'imports', 'built-in functions'],
          timeEstimate: 10
        },
        {
          id: 'py-data-analysis',
          title: '19. Simple Data Analysis',
          description: 'Learn how to perform basic data analysis in Python.',
          difficulty: 'intermediate',
          language: 'python',
          starterCode: '# Create a program that analyzes a dataset of student scores\n# Calculate the average, highest, and lowest scores\n# Count how many students scored above 90\n# Display a simple text-based histogram of score ranges\n\nscores = [85, 92, 78, 95, 88, 76, 90, 93, 65, 98, 79, 88, 82, 91, 94, 77, 84, 88, 90, 95]\n\n',
          solutionCode: 'scores = [85, 92, 78, 95, 88, 76, 90, 93, 65, 98, 79, 88, 82, 91, 94, 77, 84, 88, 90, 95]\n\n# Basic statistics\naverage_score = sum(scores) / len(scores)\nhighest_score = max(scores)\nlowest_score = min(scores)\n\nprint(f"Student Score Analysis")\nprint(f"---------------------")\nprint(f"Number of students: {len(scores)}")\nprint(f"Average score: {average_score:.2f}")\nprint(f"Highest score: {highest_score}")\nprint(f"Lowest score: {lowest_score}")\n\n# Count scores above 90\nabove_90 = len([score for score in scores if score >= 90])\nprint(f"Students scoring 90 or above: {above_90} ({(above_90/len(scores)*100):.1f}%)")\n\n# Create a simple histogram\nprint("\nScore Distribution:")\nranges = [(0, 59), (60, 69), (70, 79), (80, 89), (90, 100)]\nfor start, end in ranges:\n    count = len([score for score in scores if start <= score <= end])\n    stars = "*" * count\n    print(f"{start}-{end}: {stars} ({count})")',
          testCases: [
            {
              input: '',
              expectedOutput: 'Student Score Analysis\n---------------------\nNumber of students: 20\nAverage score: 86.40\nHighest score: 98\nLowest score: 65\nStudents scoring 90 or above: 8 (40.0%)\n\nScore Distribution:\n0-59: ({0})\n60-69: * (1)\n70-79: **** (4)\n80-89: ***** (7)\n90-100: ******** (8)',
              isHidden: false,
              explanation: 'Your code should analyze the student scores and display statistics and a histogram.'
            }
          ],
          hints: [
            'Use sum() and len() for average',
            'Use max() and min() for highest and lowest',
            'Use list comprehension with a condition to count scores above 90',
            'Create ranges for the histogram',
            'Use string multiplication to create the histogram bars'
          ],
          concepts: ['data analysis', 'statistics', 'list operations', 'visualization'],
          timeEstimate: 15
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
