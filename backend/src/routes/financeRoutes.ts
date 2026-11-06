import { Router } from 'express';
import { getFinanceSnapshot } from '../services/financeService';

const router = Router();

router.get('/finance/market', (_req, res) => {
  const snapshot = getFinanceSnapshot();
  if (!snapshot) {
    return res.status(202).json({ status: 'loading' });
  }
  res.json(snapshot);
});

export default router;
