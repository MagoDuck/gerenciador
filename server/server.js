const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

// Carrega o .env manualmente (sem dependência extra)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = (match[2] || '').trim();
    }
  });
}
if (!process.env.JWT_SECRET) {
  console.warn('Aviso: JWT_SECRET não definido no .env — usando um valor padrão inseguro. Configure server/.env antes de usar em produção.');
  process.env.JWT_SECRET = 'dev-secret-troque-isto';
}

const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const transactionsRoutes = require('./routes/transactions');
const goalsRoutes = require('./routes/goals');
const dataRoutes = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/data', dataRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`Finanças Pro API rodando em http://localhost:${PORT}`);
});
