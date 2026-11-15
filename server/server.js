require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Defina JWT_SECRET com 32 caracteres ou mais (variável de ambiente ou arquivo .env).');
  process.exit(1);
}

const app = require('./app');
const migrar = require('./migrate');

const porta = process.env.PORT || 3000;

async function iniciar() {
  // Aplica migrations pendentes no start (seguro repetir). Desative com AUTO_MIGRATE=false.
  if (process.env.AUTO_MIGRATE !== 'false') {
    await migrar();
  }
  app.listen(porta, () => console.log(`Servidor rodando na porta ${porta}`));
}

iniciar().catch((erro) => {
  console.error('Falha ao iniciar:', erro.message);
  process.exit(1);
});
