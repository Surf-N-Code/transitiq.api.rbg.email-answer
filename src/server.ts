import dotenv from 'dotenv';
// Load environment variables before any other imports
dotenv.config({
  path: process.env.NODE_ENV === 'production' ? '.env' : '.env.local',
});

import './register';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // Request logging
app.use(express.json()); // Parse JSON bodies

// Routes
app.use('/api', routes);

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  }
);

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
