/* Cliente da API + sessão + carrinho. Disponível globalmente como window.AV */
(function () {
  const API = window.API_URL || "/api";
  const CHAVE_TOKEN = "av_token";
  const CHAVE_USUARIO = "av_usuario";
  const CHAVE_CARRINHO = "av_carrinho_v2";

  /* ---------- armazenamento seguro (pode falhar em modo privado) ---------- */
  function ler(chave) {
    try { return localStorage.getItem(chave); } catch (e) { return null; }
  }
  function gravar(chave, valor) {
    try { localStorage.setItem(chave, valor); } catch (e) { /* ignora */ }
  }
  function apagar(chave) {
    try { localStorage.removeItem(chave); } catch (e) { /* ignora */ }
  }

  /* ---------- sessão ---------- */
  const token = () => ler(CHAVE_TOKEN);
  const logado = () => Boolean(token());

  function usuario() {
    try { return JSON.parse(ler(CHAVE_USUARIO)) || null; } catch (e) { return null; }
  }

  function salvarSessao(dados) {
    gravar(CHAVE_TOKEN, dados.token);
    gravar(CHAVE_USUARIO, JSON.stringify(dados.usuario));
  }

  function sair() {
    apagar(CHAVE_TOKEN);
    apagar(CHAVE_USUARIO);
  }

  /* ---------- requisições ---------- */
  async function requisicao(caminho, opcoes) {
    opcoes = opcoes || {};
    const cabecalhos = { Accept: "application/json" };
    if (opcoes.corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
    if (logado() && !opcoes.semToken) cabecalhos.Authorization = "Bearer " + token();

    let resposta;
    try {
      resposta = await fetch(API + caminho, {
        method: opcoes.metodo || "GET",
        headers: cabecalhos,
        body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
      });
    } catch (e) {
      throw new Error("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    }

    let dados = null;
    try { dados = await resposta.json(); } catch (e) { /* resposta sem corpo */ }

    if (!resposta.ok) {
      if (resposta.status === 401 && logado() && !opcoes.semToken) sair(); // sessão expirada
      let mensagem = (dados && dados.mensagem) || "Erro inesperado (" + resposta.status + ").";
      if (dados && dados.erros) mensagem += " " + Object.values(dados.erros).join("; ") + ".";
      const erro = new Error(mensagem);
      erro.status = resposta.status;
      throw erro;
    }
    return dados;
  }

  /* ---------- carrinho de visitante (localStorage) ---------- */
  function lerVisitante() {
    try {
      const lista = JSON.parse(ler(CHAVE_CARRINHO));
      return Array.isArray(lista) ? lista : [];
    } catch (e) { return []; }
  }
  const gravarVisitante = (lista) => gravar(CHAVE_CARRINHO, JSON.stringify(lista));

  function resumo(itens) {
    const total = itens.reduce((s, i) => s + Math.round(i.preco * 100) * i.quantidade, 0) / 100;
    return { itens: itens, total: total };
  }

  const carrinho = {
    // devolve { itens: [{itemId, produtoId, nome, preco, imagem, estoque, quantidade}], total }
    async listar() {
      if (logado()) return requisicao("/carrinho");
      return resumo(lerVisitante().map((i) => Object.assign({ itemId: i.produtoId }, i)));
    },

    async adicionar(produto, quantidade) {
      if (logado()) {
        return requisicao("/carrinho/itens", {
          metodo: "POST",
          corpo: { produtoId: produto.id, quantidade: quantidade },
        });
      }
      const lista = lerVisitante();
      const existente = lista.find((i) => i.produtoId === produto.id);
      const novaQtd = (existente ? existente.quantidade : 0) + quantidade;
      if (novaQtd > produto.estoque) {
        throw new Error("Quantidade maior que o estoque disponível (" + produto.estoque + ").");
      }
      if (existente) {
        existente.quantidade = novaQtd;
        existente.preco = produto.preco;
        existente.estoque = produto.estoque;
      } else {
        lista.push({
          produtoId: produto.id, nome: produto.nome, preco: produto.preco,
          imagem: produto.imagem, estoque: produto.estoque, quantidade: quantidade,
        });
      }
      gravarVisitante(lista);
    },

    async definirQuantidade(item, quantidade) {
      if (logado()) {
        return requisicao("/carrinho/itens/" + item.itemId, { metodo: "PUT", corpo: { quantidade: quantidade } });
      }
      const lista = lerVisitante();
      const alvo = lista.find((i) => i.produtoId === item.produtoId);
      if (!alvo) return;
      if (quantidade > alvo.estoque) {
        throw new Error("Quantidade maior que o estoque disponível (" + alvo.estoque + ").");
      }
      alvo.quantidade = quantidade;
      gravarVisitante(lista);
    },

    async remover(item) {
      if (logado()) return requisicao("/carrinho/itens/" + item.itemId, { metodo: "DELETE" });
      gravarVisitante(lerVisitante().filter((i) => i.produtoId !== item.produtoId));
    },

    async finalizar() {
      return requisicao("/compras", { metodo: "POST" });
    },

    // Depois do login: envia para a conta os itens que o visitante já tinha escolhido
    async sincronizarVisitante() {
      const lista = lerVisitante();
      for (const i of lista) {
        try {
          await requisicao("/carrinho/itens", {
            metodo: "POST", corpo: { produtoId: i.produtoId, quantidade: i.quantidade },
          });
        } catch (e) { /* item sem estoque ou removido: ignora */ }
      }
      apagar(CHAVE_CARRINHO);
    },
  };

  /* ---------- cabeçalho: "Entrar / Cadastrar" vira "Olá, Fulano (sair)" ---------- */
  function montarCabecalho() {
    const link = document.getElementById("linkConta");
    if (!link) return;
    const u = usuario();
    if (logado() && u) {
      link.textContent = "♙ Olá, " + String(u.nome).split(" ")[0] + " (sair)";
      link.href = "#";
      link.addEventListener("click", function (e) {
        e.preventDefault();
        sair();
        window.location.href = "/index.html";
      });
    } else {
      link.textContent = "♙ Entrar / Cadastrar";
      link.href = "/login/login.html";
    }
  }
  document.addEventListener("DOMContentLoaded", montarCabecalho);

  window.AV = {
    logado: logado,
    usuario: usuario,
    salvarSessao: salvarSessao,
    sair: sair,
    carrinho: carrinho,
    formatarPreco: function (valor) {
      return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    },
    produtos: {
      listar: () => requisicao("/produtos", { semToken: true }),
      buscar: (id) => requisicao("/produtos/" + encodeURIComponent(id), { semToken: true }),
    },
    auth: {
      cadastrar: (dados) => requisicao("/usuarios", { metodo: "POST", corpo: dados, semToken: true }),
      entrar: (dados) => requisicao("/auth/login", { metodo: "POST", corpo: dados, semToken: true }),
    },
  };
})();
