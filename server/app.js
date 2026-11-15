const path = require('path');
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { naoEncontrado, tratarErros } = require('./middleware');

const app = express();
app.disable('x-powered-by');

// Front-end e API saem do mesmo domínio, então CORS só é necessário se você
// hospedar o front-end em outro endereço. Ex.: CORS_ORIGIN=https://meusite.vercel.app
if (process.env.CORS_ORIGIN) {
  const origens = process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  app.use(cors({ origin: origens }));
}

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '100kb' }));

// Verificação de saúde (usada pelo Render) — também confirma a conexão com o banco
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (erro) {
    console.error('Health check falhou:', erro.message);
    res.status(503).json({ status: 'erro', mensagem: 'Banco de dados indisponível' });
  }
});

app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/produtos'));
app.use('/api', require('./routes/carrinho'));
app.use('/api', require('./routes/compras'));
app.use('/api', naoEncontrado);

// Front-end estático
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(naoEncontrado);

app.use(tratarErros);

module.exports = app;
