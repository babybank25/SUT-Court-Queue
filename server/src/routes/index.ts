import { Router } from 'express';
import queueRoutes from './queue';
import matchRoutes from './match';
import adminRoutes from './admin';

const router = Router();

// Queue management routes
router.use('/queue', queueRoutes);

// Match management routes
router.use('/match', matchRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Placeholder routes - will be implemented in later tasks
router.get('/court/status', (req, res) => {
  res.json({ message: 'Court status endpoint - to be implemented' });
});

export default router;