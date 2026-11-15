-- Imagem do produto (antes ficava fixa no HTML)
ALTER TABLE produtos
    ADD COLUMN IF NOT EXISTS imagem_url VARCHAR(255);

-- Controle de baixa de estoque da venda (já documentado no README do banco)
ALTER TABLE vendas
    ADD COLUMN IF NOT EXISTS estoque_baixado BOOLEAN NOT NULL DEFAULT FALSE;

-- Bancos que já tinham os produtos iniciais passam a ter as imagens
UPDATE produtos SET imagem_url = '/imagens/arroz.jpg'         WHERE nome = 'Arroz 5kg'        AND imagem_url IS NULL;
UPDATE produtos SET imagem_url = '/imagens/feijao.jpg'        WHERE nome = 'Feijão 1kg'       AND imagem_url IS NULL;
UPDATE produtos SET imagem_url = '/imagens/refrigerante.jpg'  WHERE nome = 'Refrigerante 2L'  AND imagem_url IS NULL;
UPDATE produtos SET imagem_url = '/imagens/sabonete.jpg'      WHERE nome = 'Sabonete'         AND imagem_url IS NULL;
UPDATE produtos SET imagem_url = '/imagens/detergente.jpg'    WHERE nome = 'Detergente'       AND imagem_url IS NULL;
