# 🛒 Amigo da Vizinhança

Loja online de um pequeno comércio de bairro: catálogo de produtos, carrinho, cadastro/login de clientes e finalização de compra com baixa automática de estoque.

> **🔗 Aplicação no ar:** `https://SEU-SERVICO.onrender.com` ← *substitua após o deploy (veja "Publicação" abaixo)*
>
> ⏱️ No plano gratuito do Render o serviço hiberna após alguns minutos sem acesso; a primeira visita pode levar de 30 a 60 segundos.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | HTML5, CSS3 e JavaScript (sem framework), Leaflet/OpenStreetMap na página de localização |
| API | Node.js 20+, Express 5, JWT, bcrypt |
| Banco de dados | PostgreSQL (`pg`) |
| Hospedagem (gratuita) | Render (aplicação) + Neon (PostgreSQL) |

## Arquitetura

Um único serviço Node.js entrega o site e a API no mesmo endereço, o que dispensa configuração de CORS.

```
amigo-da-vizinhanca/
├── server/            API Express (rotas, autenticação, migrations)
│   ├── server.js      ponto de entrada (valida env, migra o banco, sobe o servidor)
│   ├── app.js         middlewares, rotas e arquivos estáticos
│   ├── db.js          conexão PostgreSQL (DATABASE_URL + SSL)
│   ├── migrate.js     executa migrations/seed de forma idempotente
│   └── routes/        auth, produtos, carrinho, compras
├── database/          SQL: migrations, seeds, consultas e testes de validação
├── public/            front-end estático (loja, login, localização, equipe)
├── render.yaml        configuração de deploy no Render
└── .env.example       modelo das variáveis de ambiente
```

## Funcionalidades

- Catálogo carregado do banco, com busca e filtro por categoria
- Página de detalhes do produto com controle de quantidade (limitada ao estoque)
- Carrinho para visitantes (no navegador) e para clientes logados (no banco); ao entrar, o carrinho do visitante é levado para a conta
- Cadastro e login com JWT
- Finalização de compra transacional: registra a venda e os itens, baixa o estoque e fecha o carrinho
- Página de localização com mapa e página da equipe

## Executando localmente

Pré-requisitos: Node.js 20+ e um PostgreSQL (local ou um banco gratuito no Neon).

```bash
git clone https://github.com/gabrielarrincon/amigo-da-vizinhanca.git
cd amigo-da-vizinhanca
npm install

cp .env.example .env     # Windows: copy .env.example .env
# edite o .env: preencha DATABASE_URL (ou DB_*) e JWT_SECRET

npm start                # cria as tabelas/produtos automaticamente e sobe em http://localhost:3000
```

Comandos úteis: `npm run dev` (reinicia ao salvar) e `npm run migrate` (só prepara o banco).

Se você já tinha o banco criado manualmente com os scripts antigos, o `migrate` detecta isso, preserva os seus dados e aplica apenas as novidades.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim* | String de conexão do PostgreSQL |
| `JWT_SECRET` | Sim | Segredo com 32+ caracteres para assinar os tokens |
| `PORT` | Não | Porta (o Render define automaticamente) |
| `JWT_EXPIRATION_MINUTES` | Não | Validade do token (padrão: 60) |
| `CORS_ORIGIN` | Não | Só se o front-end ficar em outro domínio |
| `AUTO_MIGRATE` | Não | `false` desliga as migrations automáticas |

\* Alternativamente, localmente: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.

Gerar um `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Publicação gratuita (Render + Neon)

1. **Banco (Neon):** crie um projeto em [neon.tech](https://neon.tech) e copie a *connection string* (`postgresql://...?sslmode=require`).
2. **GitHub:** envie o código para o repositório (o `.env` **não** é versionado).
3. **Aplicação (Render):** em [render.com](https://render.com) escolha *New → Blueprint* e selecione o repositório (o `render.yaml` já configura tudo), ou crie um *Web Service* manualmente com `Build: npm install` e `Start: npm start`.
4. No painel do serviço, em *Environment*, defina `DATABASE_URL` (string do Neon) e `JWT_SECRET`.
5. No primeiro start, as tabelas e os produtos iniciais são criados automaticamente. Confira `https://SEU-SERVICO.onrender.com/api/health` → `{"status":"ok"}`.
6. Cole o endereço final na linha "Aplicação no ar" no topo deste README.

## API

Base: `/api`. Rotas marcadas com 🔒 exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Verifica API e banco |
| GET | `/produtos` · `/produtos/:id` | Catálogo |
| POST | `/usuarios` | Cadastro `{nome, email, senha}` |
| POST | `/auth/login` | Login `{email, senha}` → `{token, usuario}` |
| GET | `/usuarios/me` 🔒 | Usuário logado |
| GET | `/carrinho` 🔒 | Carrinho aberto com itens e total |
| POST | `/carrinho/itens` 🔒 | Adiciona `{produtoId, quantidade}` |
| PUT | `/carrinho/itens/:itemId` 🔒 | Define a quantidade `{quantidade}` |
| DELETE | `/carrinho/itens/:itemId` 🔒 | Remove o item |
| POST | `/compras` 🔒 | Finaliza a compra do carrinho aberto |

## Segurança

- Senhas com bcrypt; o tipo de usuário nunca é aceito do cliente (sempre `CLIENTE`)
- O usuário das rotas de carrinho e compra vem sempre do token JWT
- Consultas SQL parametrizadas; textos inseridos na página usam `textContent`
- `.env` e `node_modules` ignorados pelo Git

## Limitações conhecidas

- A compra é uma **simulação**: não há integração de pagamento.
- Não há painel administrativo para cadastrar produtos (inclua-os via SQL em `database/seeds`).
- Sem limitação de tentativas de login (rate limit) e sem recuperação de senha.

## Banco de dados

Detalhes das tabelas e relacionamentos em [`database/README.md`](database/README.md).
