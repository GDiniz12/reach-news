import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import authRoutes from './routes/authRoutes';
import storyRoutes from './routes/storyRoutes';
import { ensureSeededStories } from './services/seedService';
import {
  getSystemConfig,
  purgeExpiredStories,
  runHourlyEditorialCycle,
  cleanExistingDuplicateStories,
  reclassifyAllExistingStories,
} from './services/omnirouteService';

const app = express();
const PORT = Number(process.env.PORT || 4001);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get(['/api/health', '/reach/api/health'], (_req, res) => {
  res.json({ status: 'ok', service: 'reach.news API', timestamp: new Date().toISOString() });
});

app.use(['/api/auth', '/reach/api/auth'], authRoutes);
app.use(['/api', '/reach/api'], storyRoutes);

// Background Scheduler: Runs every 30 minutes ('*/30 * * * *')
// 1. Deletes stories older than 7 days (1 week)
// 2. Discovers Top 5 most talked-about trending topics (Google Trends + X/Twitter + Top Media) & generates 5 stories
// 3. Generates at least 2 stories for each platform category (technology, science, politics, crime, sports, entertainment, economics, videogames)
cron.schedule('*/30 * * * *', async () => {
  try {
    const config = await getSystemConfig();
    if (!config.cronEnabled) return;

    console.log('[Cron] Starting 30-min editorial cycle (5 Trending + 2 per category + 7-day retention cleanup)...');
    await runHourlyEditorialCycle();
  } catch (err) {
    console.warn('[Cron] Error in scheduled 30-min editorial cycle:', (err as Error).message);
  }
});

async function bootstrap() {
  try {
    // 1. Start HTTP server immediately to pass platform health checks and accept incoming traffic
    app.listen(PORT, () => {
      console.log(`🚀 reach.news Backend API running on http://localhost:${PORT}`);
    });

    // 2. Perform background startup tasks (config, seed, duplicates check) asynchronously
    await getSystemConfig();
    await purgeExpiredStories(7);
    await ensureSeededStories();
    await cleanExistingDuplicateStories();
    await reclassifyAllExistingStories();
  } catch (err) {
    console.error('Failed to initialize background bootstrap tasks:', err);
  }
}

bootstrap();
