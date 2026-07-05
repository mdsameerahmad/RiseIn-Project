import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import { connectDB } from './config/db';
import { initSockets } from './sockets';
import { startIndexer } from './services/indexer';

// Route imports
import escrowsRouter from './routes/escrows.routes';
import usersRouter from './routes/users.routes';
import reputationRouter from './routes/reputation.routes';
import disputesRouter from './routes/disputes.routes';
import notificationsRouter from './routes/notifications.routes';
import eventsRouter from './routes/events.routes';

// Middleware imports
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Register API routes
app.use('/api/v1/escrows', escrowsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/reputation', reputationRouter);
app.use('/api/v1/disputes', disputesRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/events', eventsRouter);

app.get('/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: 'ok',
    db: dbConnected ? 'connected' : 'disconnected'
  });
});

app.use(errorHandler);

const server = http.createServer(app);

// Initialize Socket.io on the HTTP server
initSockets(server);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  connectDB()
    .then(() => {
      // Start the blockchain event indexer loop
      startIndexer(8000);
      server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}

export { app, server };
export default app;
