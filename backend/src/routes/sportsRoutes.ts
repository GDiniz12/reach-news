import { Router } from 'express';
import { getSportsSnapshot } from '../services/sportsService';

const router = Router();

router.get('/sports/live', (_req, res) => {
  const snapshot = getSportsSnapshot();
  if (!snapshot) {
    // Cache ainda sendo montado em segundo plano; o frontend tenta de novo.
    return res.status(202).json({ status: 'loading' });
  }
  res.json(snapshot);
});

export default router;
