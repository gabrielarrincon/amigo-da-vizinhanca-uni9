const { Router } = require('express');
const pool = require('../db');
const { AppError } = require('../middleware');

const router = Router();

const SELECT_PRODUTO = `
  SELECT p.id, p.nome, p.descricao, p.preco, p.quantidade_estoque,
         p.imagem_url, c.nome AS categoria
  FROM produtos p
  INNER JOIN categorias c ON c.id = p.categoria_id
  WHERE p.ativo = TRUE
`;

const paraResposta = (p) => ({
  id: Number(p.id),
  nome: p.nome,
  descricao: p.descricao,
  preco: Number(p.preco),
  estoque: p.quantidade_estoque,
  categoria: p.categoria,
  imagem: p.imagem_url,
});

// GET /api/produtos
router.get('/produtos', async (req, res) => {
  const r = await pool.query(`${SELECT_PRODUTO} ORDER BY p.id`);
  res.json(r.rows.map(paraResposta));
});

// GET /api/produtos/:id
router.get('/produtos/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'ID de produto inválido');

  const r = await pool.query(`${SELECT_PRODUTO} AND p.id = $1`, [id]);
  if (r.rowCount === 0) throw new AppError(404, 'Produto não encontrado');
  res.json(paraResposta(r.rows[0]));
});

module.exports = router;
