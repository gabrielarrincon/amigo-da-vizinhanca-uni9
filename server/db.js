require('dotenv').config();
const { Pool } = require('pg');

// Em produção (Render + Neon/Supabase) usa-se uma única string DATABASE_URL.
// Localmente, ainda funcionam as variáveis soltas DB_HOST, DB_PORT, ...
const usaUrl = Boolean(process.env.DATABASE_URL);

const hostLocal = ['localhost', '127.0.0.1', ''].includes(process.env.DB_HOST || 'localhost');
const precisaSsl =
  process.env.DB_SSL === 'true' ||
  (usaUrl && process.env.DB_SSL !== 'false' && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL));

const config = usaUrl
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'amigo_da_vizinhanca',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

if (precisaSsl || (!usaUrl && !hostLocal)) {
  config.ssl = { rejectUnauthorized: false };
}

const pool = new Pool({ ...config, max: 5, idleTimeoutMillis: 30000 });

pool.on('error', (erro) => {
  console.error('Erro inesperado na conexão com o banco:', erro.message);
});

// Executa fn(client) dentro de uma transação (BEGIN/COMMIT, ROLLBACK em caso de erro).
pool.transacao = async function transacao(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    await client.query('ROLLBACK').catch(() => {});
    throw erro;
  } finally {
    client.release();
  }
};

module.exports = pool;
