import express from 'express';
import cors from 'cors';
import { query } from './db.js';
import praiasRouter from './routes/praias.js';
import atividadesRouter from './routes/atividades.js';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', banco: 'ok' });
  } catch {
    res.status(503).json({ status: 'erro', banco: 'indisponível' });
  }
});

app.use('/api/praias', praiasRouter);
app.use('/api/atividades', atividadesRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ erro: 'Recurso não encontrado.' });
});

app.use((erro, _req, res, _next) => {
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});
