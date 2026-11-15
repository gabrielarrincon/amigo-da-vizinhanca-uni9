const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

/* Mensagem de erro/sucesso dentro de cada formulário */
function criarMensagem(form) {
    const p = document.createElement("p");
    p.setAttribute("role", "alert");
    p.style.cssText = "margin:10px 0 0;font-size:0.9rem;min-height:1.2em;";
    form.appendChild(p);
    return p;
}
const msgLogin = criarMensagem(loginForm);
const msgCadastro = criarMensagem(registerForm);

function mostrar(elemento, texto, erro) {
    elemento.textContent = texto;
    elemento.style.color = erro ? "#AC0202" : "#1b7a1b";
}

/* Só aceita voltar para caminhos do próprio site (evita redirecionamento externo) */
function destinoSeguro() {
    const proximo = new URLSearchParams(window.location.search).get("proximo");
    return proximo && proximo.startsWith("/") && !proximo.startsWith("//") ? proximo : "/index.html";
}

document.getElementById("showRegister").addEventListener("click", (e) => {
    e.preventDefault();
    loginForm.classList.remove("active");
    registerForm.classList.add("active");
});

document.getElementById("showLogin").addEventListener("click", (e) => {
    e.preventDefault();
    registerForm.classList.remove("active");
    loginForm.classList.add("active");
});

async function entrar(email, senha) {
    const dados = await AV.auth.entrar({ email: email, senha: senha });
    AV.salvarSessao(dados);
    await AV.carrinho.sincronizarVisitante(); // leva para a conta o que o visitante já escolheu
    window.location.href = destinoSeguro();
}

// Cadastro
registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const senha = document.getElementById("registerPassword").value;
    const confirmar = document.getElementById("confirmPassword").value;

    if (senha !== confirmar) {
        mostrar(msgCadastro, "As senhas não coincidem!", true);
        return;
    }

    const botao = registerForm.querySelector("button[type='submit'], button:not([type])");
    if (botao) botao.disabled = true;
    mostrar(msgCadastro, "Criando sua conta...", false);

    try {
        await AV.auth.cadastrar({ nome: nome, email: email, senha: senha });
        await entrar(email, senha); // já entra automaticamente
    } catch (erro) {
        mostrar(msgCadastro, erro.message, true);
        if (botao) botao.disabled = false;
    }
});

// Login
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginPassword").value;

    const botao = loginForm.querySelector("button[type='submit'], button:not([type])");
    if (botao) botao.disabled = true;
    mostrar(msgLogin, "Entrando...", false);

    try {
        await entrar(email, senha);
    } catch (erro) {
        mostrar(msgLogin, erro.message, true);
        if (botao) botao.disabled = false;
    }
});
