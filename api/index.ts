// Vercel serverless entry: runs the Express app from server.ts for every /api request.
// (Relative imports need the .js extension because package.json uses "type": "module".)
import app from '../server.js';

export default app;
