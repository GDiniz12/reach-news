import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import authRoutes from './routes/authRoutes';
import storyRoutes from './routes/storyRoutes';
import sportsRoutes from './routes/sportsRoutes';
import financeRoutes from './routes/financeRoutes';
import { refreshSportsSnapshot } from './services/sportsService';
import { refreshFinanceSnapshot } from './services/financeService';
import { ensureSeededStories } from './services/seedService';
import {
  getSystemConfig,
  purgeExpiredStories,
  runHourlyEditorialCycle,
  cleanExistingDuplicateStories,
  reclassifyAllExistingStories,
  repairExistingStoryImages,
} from './services/omnirouteService';
import {
  isAiRestPeriod,
  getBrtTime,
  SCHEDULE_TIMEZONE,
} from './services/aiScheduleService';

const app = express();
const PORT = Number(process.env.PORT || 4001);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get(['/api/health', '/reach/api/health'], (_req, res) => {
  res.json({ status: 'ok', service: 'reach.news API', timestamp: new Date().toISOString() });
});

app.use(['/api/auth', '/reach/api/auth'], authRoutes);
app.use(['/api', '/reach/api'], sportsRoutes);
app.use(['/api', '/reach/api'], financeRoutes);
app.use(['/api', '/reach/api'], storyRoutes);

// ============================================================================
// AGENDAMENTO DE FREQUÊNCIA DA IA (Fuso Horário: America/Sao_Paulo)
// - 00h00 às 05h00: Descanso total da IA (Esportes, Dados Financeiros e Notícias pausados).
// - 05h01 às 18h00:
//   • Notícias: a cada 1 hora
//   • Dados Financeiros: de 2 em 2 horas
//   • Esportes: de 45 em 45 min das 05h01 às 12h00; modo ativo das 12h01 às 18h00
// - 18h01 às 23h59:
//   • Notícias: a cada 2 horas
//   • Dados Financeiros: de 2 em 2 horas
//   • Esportes: modo ativo (atualização a cada minuto)
// ============================================================================

// Sports hub:
// - 00h00–05h00: bloqueado pelo isAiRestPeriod()
// - 05h01–12h00: getSportsIntervalsMs() aplica intervalo mínimo de 45 minutos
// - 12h01–23h59: modo ativo (atualização a cada minuto)
cron.schedule(
  '* * * * *',
  () => {
    if (isAiRestPeriod()) return;
    void refreshSportsSnapshot();
  },
  { timezone: SCHEDULE_TIMEZONE }
);

// Finance hub:
// - 00h00–05h00: descanso
// - 05h01–23h59: consultado de 2 em 2 horas (verificado pelo TTL de 2h em refreshFinanceSnapshot)
cron.schedule(
  '* * * * *',
  () => {
    if (isAiRestPeriod()) return;
    void refreshFinanceSnapshot();
  },
  { timezone: SCHEDULE_TIMEZONE }
);

// Notícias (Ciclo Editorial da IA):
// - 00h00–05h00: descanso
// - 05h01–18h00: acionado a cada 1 hora
// - 18h01–23h59: acionado a cada 2 horas
// (O controle exato de 1h vs 2h e bloqueio 00h-05h também é validado dentro de runHourlyEditorialCycle)
cron.schedule(
  '* * * * *',
  async () => {
    try {
      if (isAiRestPeriod()) return;
      const config = await getSystemConfig();
      if (!config.cronEnabled) return;

      await runHourlyEditorialCycle();
    } catch (err) {
      console.warn('[Cron] Error in scheduled editorial cycle:', (err as Error).message);
    }
  },
  { timezone: SCHEDULE_TIMEZONE }
);

async function bootstrap() {
  try {
    // 1. Start HTTP server immediately to pass platform health checks and accept incoming traffic
    app.listen(PORT, () => {
      console.log(`🚀 reach.news Backend API running on http://localhost:${PORT}`);
    });

    // 2. Perform background startup tasks (config, seed, duplicates check) asynchronously
    await getSystemConfig();
    if (!isAiRestPeriod()) {
      void refreshSportsSnapshot(); // aquece o cache esportivo logo na inicialização (fora do horário de descanso)
      void refreshFinanceSnapshot(); // aquece o cache financeiro logo na inicialização (fora do horário de descanso)
    } else {
      console.log(
        `[Schedule] Horário de descanso da IA ativo (${getBrtTime().formatted} BRT - 00h às 05h). Atualizações automáticas aguardando 05h01.`
      );
    }
    await purgeExpiredStories(7);
    await ensureSeededStories();
    await cleanExistingDuplicateStories();
    await reclassifyAllExistingStories();
    await repairExistingStoryImages();
  } catch (err) {
    console.error('Failed to initialize background bootstrap tasks:', err);
  }
}

bootstrap();
