const { Router } = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { AppError, gerarToken, autenticar } = require('../middleware');

const router = Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const paraResposta = (u) => ({ id: Number(u.id), nome: u.nome, email: u.email });

function validarCadastro(d) {
  const erros = {};
  if (!d.nome || !String(d.nome).trim()) erros.nome = 'nome é obrigatório';
  if (!d.email || !EMAIL_REGEX.test(String(d.email).trim())) erros.email = 'email inválido';
  if (!d.senha || String(d.senha).length < 6) erros.senha = 'senha deve ter no mínimo 6 caracteres';
  if (Object.keys(erros).length) throw new AppError(400, 'Dados inválidos', erros);
}

// POST /api/usuarios  → cadastro (o tipo é sempre CLIENTE, nunca vem do JSON)
router.post('/usuarios', async (req, res) => {
  const dados = req.body || {};
  validarCadastro(dados);

  const email = String(dados.email).trim().toLowerCase();
  const nome = String(dados.nome).trim();
  const senhaHash = await bcrypt.hash(String(dados.senha), 10);

  try {
    const r = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo)
       VALUES ($1, $2, $3, 'CLIENTE')
       RETURNING id, nome, email`,
      [nome, email, senhaHash]
    );
    res.status(201).json(paraResposta(r.rows[0]));
  } catch (e) {
    if (e.code === '23505') throw new AppError(409, 'E-mail já cadastrado');
    throw e;
  }
});

// POST /api/auth/login → { token, usuario }
router.post('/auth/login', async (req, res) => {
  const dados = req.body || {};
  if (!dados.email || !dados.senha) {
    throw new AppError(400, 'Dados inválidos', {
      ...(!dados.email && { email: 'email é obrigatório' }),
      ...(!dados.senha && { senha: 'senha é obrigatória' }),
    });
  }

  const email = String(dados.email).trim().toLowerCase();
  const r = await pool.query(
    'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1 AND ativo = TRUE',
    [email]
  );
  const usuario = r.rows[0];

  if (!usuario || !(await bcrypt.compare(String(dados.senha), usuario.senha_hash))) {
    throw new AppError(401, 'E-mail ou senha inválidos');
  }

  res.json({ token: gerarToken(usuario), usuario: paraResposta(usuario) });
});

// GET /api/usuarios/me → dados do usuário logado
router.get('/usuarios/me', autenticar, async (req, res) => {
  const r = await pool.query('SELECT id, nome, email FROM usuarios WHERE id = $1', [req.usuarioId]);
  res.json(paraResposta(r.rows[0]));
});

module.exports = router;
