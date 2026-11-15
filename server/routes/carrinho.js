const { Router } = require('express');
const pool = require('../db');
const { AppError, autenticar } = require('../middleware');

const router = Router();
router.use('/carrinho', autenticar); // o usuário vem SEMPRE do token, nunca do corpo da requisição

const inteiroPositivo = (v) => Number.isInteger(v) && v > 0;

async function obterOuCriarCarrinho(conexao, usuarioId) {
  const r = await conexao.query(
    `SELECT id FROM carrinhos
     WHERE usuario_id = $1 AND status = 'ABERTO'
     ORDER BY id DESC LIMIT 1`,
    [usuarioId]
  );
  if (r.rows.length > 0) return r.rows[0].id;

  const novo = await conexao.query(
    `INSERT INTO carrinhos (usuario_id, status) VALUES ($1, 'ABERTO') RETURNING id`,
    [usuarioId]
  );
  return novo.rows[0].id;
}

// GET /api/carrinho
router.get('/carrinho', async (req, res) => {
  const carrinhoId = await obterOuCriarCarrinho(pool, req.usuarioId);

  const r = await pool.query(
    `SELECT ic.id AS item_id, p.id AS produto_id, p.nome, p.preco, p.imagem_url,
            p.quantidade_estoque, ic.quantidade
     FROM itens_carrinho ic
     INNER JOIN produtos p ON p.id = ic.produto_id
     WHERE ic.carrinho_id = $1
     ORDER BY ic.id`,
    [carrinhoId]
  );

  const itens = r.rows.map((i) => ({
    itemId: Number(i.item_id),
    produtoId: Number(i.produto_id),
    nome: i.nome,
    preco: Number(i.preco),
    imagem: i.imagem_url,
    estoque: i.quantidade_estoque,
    quantidade: i.quantidade,
    subtotal: Math.round(Number(i.preco) * i.quantidade * 100) / 100,
  }));
  const total = Math.round(itens.reduce((s, i) => s + i.subtotal * 100, 0)) / 100;

  res.json({ carrinhoId: Number(carrinhoId), itens, total });
});

// POST /api/carrinho/itens   { produtoId, quantidade }
router.post('/carrinho/itens', async (req, res) => {
  const produtoId = Number(req.body?.produtoId);
  const quantidade = Number(req.body?.quantidade ?? 1);
  if (!inteiroPositivo(produtoId) || !inteiroPositivo(quantidade)) {
    throw new AppError(400, 'Dados do produto inválidos.');
  }

  await pool.transacao(async (conn) => {
    const produto = await conn.query(
      `SELECT quantidade_estoque FROM produtos WHERE id = $1 AND ativo = TRUE FOR UPDATE`,
      [produtoId]
    );
    if (produto.rows.length === 0) throw new AppError(404, 'Produto não encontrado.');

    const carrinhoId = await obterOuCriarCarrinho(conn, req.usuarioId);

    const atual = await conn.query(
      'SELECT quantidade FROM itens_carrinho WHERE carrinho_id = $1 AND produto_id = $2',
      [carrinhoId, produtoId]
    );
    const quantidadeAtual = atual.rows.length ? atual.rows[0].quantidade : 0;

    if (quantidadeAtual + quantidade > produto.rows[0].quantidade_estoque) {
      throw new AppError(400, 'Quantidade solicitada maior que o estoque disponível.');
    }

    await conn.query(
      `INSERT INTO itens_carrinho (carrinho_id, produto_id, quantidade)
       VALUES ($1, $2, $3)
       ON CONFLICT (carrinho_id, produto_id)
       DO UPDATE SET quantidade = itens_carrinho.quantidade + EXCLUDED.quantidade`,
      [carrinhoId, produtoId, quantidade]
    );
  });

  res.status(201).json({ mensagem: 'Produto adicionado ao carrinho.' });
});

// PUT /api/carrinho/itens/:itemId   { quantidade }   (define a nova quantidade)
router.put('/carrinho/itens/:itemId', async (req, res) => {
  const itemId = Number(req.params.itemId);
  const quantidade = Number(req.body?.quantidade);
  if (!inteiroPositivo(itemId) || !inteiroPositivo(quantidade)) {
    throw new AppError(400, 'Dados inválidos.');
  }

  // CORREÇÃO: compara a NOVA quantidade ($1) com o estoque
  const r = await pool.query(
    `UPDATE itens_carrinho ic
     SET quantidade = $1
     FROM carrinhos c, produtos p
     WHERE ic.id = $2
       AND ic.carrinho_id = c.id
       AND ic.produto_id = p.id
       AND c.usuario_id = $3
       AND c.status = 'ABERTO'
       AND $1 <= p.quantidade_estoque
     RETURNING ic.id`,
    [quantidade, itemId, req.usuarioId]
  );

  if (r.rowCount === 0) throw new AppError(400, 'Item não encontrado ou quantidade acima do estoque.');
  res.json({ mensagem: 'Quantidade atualizada.' });
});

// DELETE /api/carrinho/itens/:itemId
router.delete('/carrinho/itens/:itemId', async (req, res) => {
  const itemId = Number(req.params.itemId);
  if (!inteiroPositivo(itemId)) throw new AppError(400, 'Dados inválidos.');

  const r = await pool.query(
    `DELETE FROM itens_carrinho ic
     USING carrinhos c
     WHERE ic.id = $1 AND ic.carrinho_id = c.id
       AND c.usuario_id = $2 AND c.status = 'ABERTO'
     RETURNING ic.id`,
    [itemId, req.usuarioId]
  );

  if (r.rowCount === 0) throw new AppError(404, 'Item não encontrado.');
  res.json({ mensagem: 'Produto removido do carrinho.' });
});

module.exports = router;
