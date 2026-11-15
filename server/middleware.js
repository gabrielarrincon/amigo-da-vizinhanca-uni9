const jwt = require('jsonwebtoken');
const pool = require('./db');

class AppError extends Error {
  constructor(status, message, detalhes) {
    super(message);
    this.status = status;
    this.detalhes = detalhes;
  }
}

function gerarToken(usuario) {
  const minutos = Number(process.env.JWT_EXPIRATION_MINUTES || 60);
  return jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    issuer: 'amigo-da-vizinhanca',
    subject: String(usuario.id), // o "sub" do token é o id do usuário
    expiresIn: minutos * 60,
  });
}

// Exige "Authorization: Bearer <token>" e disponibiliza req.usuarioId
async function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) throw new AppError(401, 'Token ausente');

  let id;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'amigo-da-vizinhanca',
    });
    id = Number(payload.sub);
  } catch {
    throw new AppError(401, 'Token inválido ou expirado');
  }

  const r = await pool.query('SELECT id FROM usuarios WHERE id = $1 AND ativo = TRUE', [id]);
  if (r.rowCount === 0) throw new AppError(401, 'Usuário não encontrado');

  req.usuarioId = id;
  next();
}

function naoEncontrado(req, res) {
  res.status(404).json({ mensagem: 'Rota não encontrada' });
}

// eslint-disable-next-line no-unused-vars
function tratarErros(err, req, res, next) {
  if (err instanceof AppError) {
    const corpo = { mensagem: err.message };
    if (err.detalhes) corpo.erros = err.detalhes;
    return res.status(err.status).json(corpo);
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ mensagem: 'JSON inválido' });
  }
  console.error(err);
  res.status(500).json({ mensagem: 'Erro interno do servidor' });
}

module.exports = { AppError, gerarToken, autenticar, naoEncontrado, tratarErros };
