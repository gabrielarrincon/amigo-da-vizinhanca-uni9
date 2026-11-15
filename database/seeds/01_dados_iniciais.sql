INSERT INTO categorias (nome, descricao)
VALUES
    ('Mercearia', 'Alimentos e produtos básicos'),
    ('Bebidas', 'Bebidas variadas'),
    ('Higiene', 'Produtos de higiene pessoal'),
    ('Limpeza', 'Produtos para limpeza doméstica');

INSERT INTO produtos
    (categoria_id, nome, descricao, imagem_url, preco, quantidade_estoque)
VALUES
    (1, 'Arroz 5kg', 'Arroz para acompanhar suas refeições e deixar o dia a dia mais prático.', '/imagens/arroz.jpg', 28.90, 20),
    (1, 'Feijão 1kg', 'Feijão para preparar refeições saborosas para toda a família.', '/imagens/feijao.jpg', 8.50, 30),
    (2, 'Refrigerante 2L', 'Refrigerante de 2 litros, ideal para compartilhar nas refeições e momentos especiais.', '/imagens/refrigerante.jpg', 9.99, 15),
    (3, 'Sabonete', 'Sabonete para fazer parte da sua rotina diária de higiene.', '/imagens/sabonete.jpg', 3.50, 40),
    (4, 'Detergente', 'Detergente para ajudar na limpeza de pratos, copos e utensílios de cozinha.', '/imagens/detergente.jpg', 2.99, 25);
