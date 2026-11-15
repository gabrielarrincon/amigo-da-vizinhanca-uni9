const fs = require('fs');
const path = require('path');
const pool = require('./db');

const DIR_MIGRATIONS = path.join(__dirname, '..', 'database', 'migrations');
const DIR_SEEDS = path.join(__dirname, '..', 'database', 'seeds');

const listarSql = (dir) =>
  fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

async function existeTabela(client, nome) {
  const r = await client.query('SELECT to_regclass($1) AS t', [`public.${nome}`]);
  return r.rows[0].t !== null;
}

async function aplicar(client, nome, sql) {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [nome]);
    await client.query('COMMIT');
    console.log(`  ✔ ${nome}`);
  } catch (erro) {
    await client.query('ROLLBACK');
    throw new Error(`Falha em ${nome}: ${erro.message}`);
  }
}

// Roda as migrations pendentes e o seed inicial (apenas se o catálogo estiver vazio).
// Pode ser executado quantas vezes quiser: só aplica o que ainda não foi aplicado.
async function migrar() {
  const client = await pool.connect();
  try {
    // trava para duas instâncias não migrarem ao mesmo tempo
    await client.query('SELECT pg_advisory_lock(727274)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nome VARCHAR(255) PRIMARY KEY,
        aplicada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const jaAplicadas = new Set(
      (await client.query('SELECT nome FROM schema_migrations')).rows.map((r) => r.nome)
    );

    // Banco criado à mão antes deste script: marca 01..07 como já aplicadas
    if (jaAplicadas.size === 0 && (await existeTabela(client, 'categorias'))) {
      console.log('Banco existente detectado: registrando migrations 01-07 como aplicadas.');
      for (const nome of listarSql(DIR_MIGRATIONS).filter((n) => /^0[1-7]/.test(n))) {
        await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [nome]);
        jaAplicadas.add(nome);
      }
    }

    console.log('Migrations:');
    let aplicadasAgora = 0;
    for (const nome of listarSql(DIR_MIGRATIONS)) {
      if (jaAplicadas.has(nome)) continue;
      await aplicar(client, nome, fs.readFileSync(path.join(DIR_MIGRATIONS, nome), 'utf8'));
      aplicadasAgora++;
    }
    if (aplicadasAgora === 0) console.log('  (nada pendente)');

    // Seed só quando não há nenhum produto cadastrado
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM produtos');
    if (rows[0].n === 0) {
      console.log('Seed:');
      for (const nome of listarSql(DIR_SEEDS)) {
        await client.query('BEGIN');
        try {
          await client.query(fs.readFileSync(path.join(DIR_SEEDS, nome), 'utf8'));
          await client.query('COMMIT');
          console.log(`  ✔ ${nome}`);
        } catch (erro) {
          await client.query('ROLLBACK');
          throw new Error(`Falha no seed ${nome}: ${erro.message}`);
        }
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => {});
    client.release();
  }
}

module.exports = migrar;

// Execução direta: npm run migrate
if (require.main === module) {
  migrar()
    .then(() => { console.log('Banco pronto.'); return pool.end(); })
    .catch((erro) => { console.error(erro.message); process.exit(1); });
}
