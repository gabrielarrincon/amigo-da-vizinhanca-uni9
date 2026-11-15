const { Router } = require('express');
const pool = require('../db');
const { AppError, autenticar } = require('../middleware');

const router = Router();
router.use('/compras', autenticar);

// POST /api/compras → transforma o carrinho aberto em uma venda e dá baixa no estoque
router.post('/compras', async (req, res) => {
  const venda = await pool.transacao(async (conn) => {
    const carrinho = await conn.query(
      `SELECT id FROM carrinhos
       WHERE usuario_id = $1 AND status = 'ABERTO'
       ORDER BY id DESC LIMIT 1
       FOR UPDATE`,
      [req.usuarioId]
    );
    if (carrinho.rows.length === 0) throw new AppError(400, 'Seu carrinho está vazio.');
    const carrinhoId = carrinho.rows[0].id;

    // trava os produtos em ordem de id (evita deadlock entre compras simultâneas)
    const itens = await conn.query(
      `SELECT p.id AS produto_id, p.nome, p.preco, p.ativo, p.quantidade_estoque, ic.quantidade
       FROM itens_carrinho ic
       INNER JOIN produtos p ON p.id = ic.produto_id
       WHERE ic.carrinho_id = $1
       ORDER BY p.id
       FOR UPDATE OF p`,
      [carrinhoId]
    );
    if (itens.rows.length === 0) throw new AppError(400, 'Seu carrinho está vazio.');

    for (const i of itens.rows) {
      if (!i.ativo) throw new AppError(409, `"${i.nome}" não está mais disponível.`);
      if (i.quantidade > i.quantidade_estoque) {
        throw new AppError(
          409,
          `Estoque insuficiente para "${i.nome}" (disponível: ${i.quantidade_estoque}).`
        );
      }
    }

    const totalCentavos = itens.rows.reduce(
      (soma, i) => soma + Math.round(Number(i.preco) * 100) * i.quantidade,
      0
    );

    const v = await conn.query(
      `INSERT INTO vendas (usuario_id, valor_total, status, estoque_baixado)
       VALUES ($1, $2, 'CONCLUIDA', TRUE)
       RETURNING id, data_venda`,
      [req.usuarioId, totalCentavos / 100]
    );
    const vendaId = v.rows[0].id;

    for (const i of itens.rows) {
      await conn.query(
        `INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario)
         VALUES ($1, $2, $3, $4)`,
        [vendaId, i.produto_id, i.quantidade, i.preco]
      );
      await conn.query(
        'UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2',
        [i.quantidade, i.produto_id]
      );
    }

    await conn.query(
      `UPDATE carrinhos SET status = 'FINALIZADO', data_atualizacao = CURRENT_TIMESTAMP WHERE id = $1`,
      [carrinhoId]
    );

    return { id: Number(vendaId), data: v.rows[0].data_venda, total: totalCentavos / 100, itens: itens.rows.length };
  });

  res.status(201).json({ mensagem: 'Compra realizada com sucesso!', venda });
});

module.exports = router;
