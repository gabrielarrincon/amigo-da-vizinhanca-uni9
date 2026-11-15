/* Páginas da loja: index (catálogo), detalhes e carrinho. Usa window.AV (api.js). */
document.addEventListener("DOMContentLoaded", function () {
  const fmt = AV.formatarPreco;

  function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function normalizar(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /* ================= PÁGINA INICIAL ================= */
  const lista = document.getElementById("listaProdutos");

  if (lista) {
    const campoBusca = document.getElementById("busca");
    const botaoPesquisar = document.getElementById("botaoPesquisar");
    const mensagem = document.getElementById("mensagemCarrinho");
    let produtos = [];
    let categoriaSelecionada = "todas";

    function avisar(texto) { if (mensagem) mensagem.textContent = texto; }

    function desenhar() {
      const termo = normalizar(campoBusca ? campoBusca.value.trim() : "");
      lista.innerHTML = "";

      const visiveis = produtos.filter(function (p) {
        const nomeOk = normalizar(p.nome).includes(termo);
        const catOk = categoriaSelecionada === "todas" || normalizar(p.categoria) === categoriaSelecionada;
        return nomeOk && catOk;
      });

      if (visiveis.length === 0) {
        lista.appendChild(el("p", "", "Nenhum produto encontrado."));
        return;
      }

      visiveis.forEach(function (p) {
        const card = el("article", "produto");
        card.dataset.categoria = normalizar(p.categoria);

        const img = el("img", "imagem-produto");
        img.src = p.imagem || "";
        img.alt = p.nome;
        img.title = "Ver detalhes do produto";
        img.style.cursor = "pointer";
        img.addEventListener("error", function () { img.style.visibility = "hidden"; });

        const info = el("div", "detalhes-produto");
        const titulo = el("h3", "", p.nome);
        titulo.title = "Ver detalhes do produto";
        titulo.style.cursor = "pointer";

        const abrir = function () { window.location.href = "/detalhes.html?id=" + p.id; };
        img.addEventListener("click", abrir);
        titulo.addEventListener("click", abrir);

        const botao = el("button", "", p.estoque > 0 ? "Adicionar ao carrinho" : "Esgotado");
        botao.type = "button";
        botao.disabled = p.estoque <= 0;
        botao.addEventListener("click", async function () {
          botao.disabled = true;
          try {
            await AV.carrinho.adicionar(p, 1);
            avisar(p.nome + " adicionado ao carrinho!");
          } catch (e) {
            avisar(e.message);
          } finally {
            botao.disabled = p.estoque <= 0;
          }
        });

        info.append(titulo, el("p", "", p.descricao || ""), el("p", "preco", fmt(p.preco)), botao);
        card.append(img, info);
        lista.appendChild(card);
      });
    }

    if (campoBusca) campoBusca.addEventListener("input", desenhar);
    if (botaoPesquisar) botaoPesquisar.addEventListener("click", desenhar);

    document.querySelectorAll(".categoria").forEach(function (botao) {
      botao.addEventListener("click", function () {
        categoriaSelecionada = botao.dataset.categoria || "todas";
        desenhar();
        const secao = document.getElementById("produtos");
        if (secao) secao.scrollIntoView({ behavior: "smooth" });
      });
    });

    lista.appendChild(el("p", "", "Carregando produtos..."));
    AV.produtos.listar()
      .then(function (dados) { produtos = dados; desenhar(); })
      .catch(function (e) {
        lista.innerHTML = "";
        lista.appendChild(el("p", "", e.message));
      });
  }

  /* ================= DETALHES ================= */
  const detalheNome = document.getElementById("detalheNome");

  if (detalheNome) {
    const imagem = document.getElementById("detalheImagem");
    const categoria = document.getElementById("detalheCategoria");
    const descricao = document.getElementById("detalheDescricao");
    const preco = document.getElementById("detalhePreco");
    const qtdTexto = document.getElementById("quantidadeDetalhe");
    const menos = document.getElementById("diminuirQuantidade");
    const mais = document.getElementById("aumentarQuantidade");
    const adicionar = document.getElementById("adicionarDetalhe");
    const msg = document.getElementById("mensagemDetalhe");

    let quantidade = 1;
    let produto = null;

    function naoEncontrado(texto) {
      detalheNome.textContent = "Produto não encontrado";
      descricao.textContent = texto || "Volte para a loja e escolha um produto disponível.";
      imagem.style.display = "none";
      preco.textContent = "";
      categoria.textContent = "";
      adicionar.disabled = true;
    }

    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      naoEncontrado();
    } else {
      AV.produtos.buscar(id)
        .then(function (p) {
          produto = p;
          imagem.src = p.imagem || "";
          imagem.alt = p.nome;
          detalheNome.textContent = p.nome;
          categoria.textContent = p.categoria;
          descricao.textContent = p.descricao || "";
          preco.textContent = fmt(p.preco);
          document.title = p.nome + " - Amigo da Vizinhança";
          if (p.estoque <= 0) { adicionar.disabled = true; msg.textContent = "Produto esgotado."; }
        })
        .catch(function (e) { naoEncontrado(e.status === 404 ? undefined : e.message); });
    }

    menos.addEventListener("click", function () {
      if (quantidade > 1) { quantidade--; qtdTexto.textContent = quantidade; }
    });
    mais.addEventListener("click", function () {
      if (produto && quantidade >= produto.estoque) return;
      quantidade++;
      qtdTexto.textContent = quantidade;
    });

    adicionar.addEventListener("click", async function () {
      if (!produto) return;
      adicionar.disabled = true;
      try {
        await AV.carrinho.adicionar(produto, quantidade);
        msg.textContent = quantidade + " unidade(s) de " + produto.nome + " adicionada(s) ao carrinho!";
      } catch (e) {
        msg.textContent = e.message;
      } finally {
        adicionar.disabled = false;
      }
    });
  }

  /* ================= CARRINHO ================= */
  const areaItens = document.getElementById("itensCarrinho");

  if (areaItens) {
    const totalEl = document.getElementById("totalCarrinho");
    const finalizar = document.getElementById("finalizarCompra");
    const aviso = document.getElementById("mensagemCompra");

    function mostrar(texto, erro) {
      aviso.textContent = texto || "";
      aviso.style.color = erro ? "#AC0202" : "#1b7a1b";
    }

    async function acao(fn) {
      try { await fn(); mostrar(""); } catch (e) { mostrar(e.message, true); }
      await desenhar();
    }

    async function desenhar() {
      let dados;
      try {
        dados = await AV.carrinho.listar();
      } catch (e) {
        areaItens.textContent = e.message;
        return;
      }

      areaItens.innerHTML = "";
      if (dados.itens.length === 0) areaItens.textContent = "Seu carrinho está vazio.";

      let qtdTotal = 0;
      dados.itens.forEach(function (item) {
        qtdTotal += item.quantidade;

        const linha = el("div", "item-carrinho");
        const img = el("img", "imagem-item-carrinho");
        img.alt = item.nome;
        img.src = item.imagem || "";
        img.addEventListener("error", function () { img.style.display = "none"; });

        const desc = el("p", "descricao-item-carrinho", item.nome + " — " + fmt(item.preco) + " cada");

        const controles = el("div", "controles-quantidade");
        const diminuir = el("button", "", "−");
        diminuir.type = "button";
        const qtd = el("span", "quantidade-item", String(item.quantidade));
        const aumentar = el("button", "", "+");
        aumentar.type = "button";
        aumentar.disabled = item.quantidade >= item.estoque;

        diminuir.addEventListener("click", function () {
          acao(function () {
            return item.quantidade <= 1
              ? AV.carrinho.remover(item)
              : AV.carrinho.definirQuantidade(item, item.quantidade - 1);
          });
        });
        aumentar.addEventListener("click", function () {
          acao(function () { return AV.carrinho.definirQuantidade(item, item.quantidade + 1); });
        });
        controles.append(diminuir, qtd, aumentar);

        const subtotal = el("p", "subtotal-item", fmt(item.preco * item.quantidade));
        const remover = el("button", "botao-remover", "Remover");
        remover.type = "button";
        remover.addEventListener("click", function () { acao(function () { return AV.carrinho.remover(item); }); });

        linha.append(img, desc, controles, subtotal, remover);
        areaItens.appendChild(linha);
      });

      totalEl.textContent = "Total (" + qtdTotal + " itens): " + fmt(dados.total);
      finalizar.disabled = dados.itens.length === 0;
    }

    finalizar.addEventListener("click", async function () {
      if (!AV.logado()) {
        window.location.href = "/login/login.html?proximo=/carrinho.html";
        return;
      }
      finalizar.disabled = true;
      try {
        const r = await AV.carrinho.finalizar();
        areaItens.innerHTML = "";
        totalEl.textContent = "";
        mostrar(r.mensagem + " Pedido nº " + r.venda.id + " — total " + fmt(r.venda.total) + ".");
      } catch (e) {
        mostrar(e.message, true);
        await desenhar();
      }
    });

    desenhar();
  }
});
