import app from '../server/app';

/**
 * Vercel Serverless Function entry point.
 * Exports the Express application directly, allowing Vercel's Node.js runtime
 * to dispatch all incoming HTTP requests to the centralized API router.
 */
export default app;
