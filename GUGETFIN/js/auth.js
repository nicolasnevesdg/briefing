// Função de Login Real
async function fazerLogin() {
    try {
        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-senha').value;
        const loader = document.getElementById('auth-splash-loader'); 
        const form = document.getElementById('login-form');

        if (!email || !senha) {
            alert("Preencha e-mail e senha!");
            return;
        }

        // Esconde o formulário e mostra o loader
        if (form) form.style.display = 'none';
        if (loader) loader.style.display = 'block';

        // Tenta fazer o login no Firebase
        await window.signInWithEmailAndPassword(window.auth, email, senha);
        
        // Se der certo, o Vigia (onAuthStateChanged) vai assumir e esconder a tela!
        
    } catch (error) {
        console.error("Erro no login:", error);
        alert("Erro ao entrar: " + error.message);
        
        // Se der erro (ex: senha errada), ele remove o loader e devolve o formulário
        const loader = document.getElementById('auth-splash-loader'); 
        const form = document.getElementById('login-form');
        if (form) form.style.display = 'block';
        if (loader) loader.style.display = 'none';
    }
}

// Função de Registro Real (Mantenha apenas ESTA versão)
async function fazerCadastro() {
    try {
        const nome = document.getElementById('register-nome').value.trim();
        const email = document.getElementById('register-email').value;
        const senha = document.getElementById('register-senha').value;
        const senhaConf = document.getElementById('register-senha-conf').value;
        
        const loader = document.getElementById('auth-splash-loader'); 
        const form = document.getElementById('register-form');

        if (!nome || !email || !senha || !senhaConf) {
            alert("Preencha todos os campos!");
            return;
        }
        if (senha.length < 6) {
            alert("A senha deve ter pelo menos 6 caracteres.");
            return;
        }
        if (senha !== senhaConf) {
            alert("As senhas não coincidem!");
            return;
        }

        // Esconde o formulário e mostra o loader
        if (form) form.style.display = 'none';
        if (loader) loader.style.display = 'block';

        // Cria a conta e atualiza o nome
        const userCredential = await window.createUserWithEmailAndPassword(window.auth, email, senha);
        await window.updateProfile(userCredential.user, { displayName: nome });
		
		// 👇 CÓDIGO NOVO: RECOMPENSA DA INDICAÇÃO FICA AQUI 👇
        const amigoQueIndicou = sessionStorage.getItem('referral_uid');
        if (amigoQueIndicou) {
            const amigoRef = window.doc(window.db, 'usuarios', amigoQueIndicou);
            window.getDoc(amigoRef).then(snap => {
                if(snap.exists()) {
                    let dadosAmigo = snap.data();
                    // Garante que o número existe e soma 1
                    let convitesUsados = (dadosAmigo.convitesUsados || 0) + 1;
                    // Atualiza apenas o campo de convites sem apagar os outros dados
                    window.setDoc(amigoRef, { convitesUsados: convitesUsados }, { merge: true });
                }
            });
            sessionStorage.removeItem('referral_uid'); 
        }
        
    } catch (error) {
        console.error("Erro no cadastro:", error);
        alert("Erro ao cadastrar: " + error.message);
        
        // Se der erro (ex: e-mail já existe), ele remove o loader e devolve o formulário
        const loader = document.getElementById('auth-splash-loader'); 
        const form = document.getElementById('register-form');
        if (form) form.style.display = 'block';
        if (loader) loader.style.display = 'none';
    }
}

// --- O VIGIA (Monitora se o usuário está logado) ---
// Trava de segurança para evitar que o app trave num loop infinito
let isSincronizando = false; 

// Envolvemos o vigia nesta função para ele esperar o Firebase carregar
// Envolvemos o vigia nesta função para ele esperar o Firebase carregar
// Envolvemos o vigia nesta função para ele esperar o Firebase carregar
// Envolvemos o vigia nesta função para ele esperar o Firebase carregar
window.iniciarVigia = function() {
    window.onAuthStateChanged(window.auth, async (user) => {
        const authScreen = document.getElementById('auth-screen');
        
        if (user) {
            // --- USUÁRIO LOGADO ---
            authScreen.style.display = 'none'; 
            
            const splashLoader = document.getElementById('auth-splash-loader');
            if (splashLoader) splashLoader.style.display = 'block';

            atualizarSaudacao(user.displayName || "Visitante");
            
            try {
                // Vai na nuvem buscar os dados
                const uid = user.uid;
                const userDoc = window.doc(window.db, "usuarios", uid);
                const docSnap = await window.getDoc(userDoc);

                if (docSnap.exists() && docSnap.data().dados) {
                    // SE ELE JÁ TEM CONTA
                    salsiData = docSnap.data().dados;
                    
                    // Blindagem: Se for uma conta antiga que não tinha detalhesBancos
                    if (!salsiData.config.detalhesBancos) salsiData.config.detalhesBancos = [];
                    
                    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
                } else {
                    // SE É CONTA NOVA ZERADA: Cria a estrutura inicial perfeita
                    console.log("Usuário novo! Criando estrutura inicial...");
                    salsiData = {
                        config: { 
                            categorias: [
                                "Alimentação", "Assinaturas", "Lazer", "Outros", 
                                "Transporte", "Presentes", "Saúde/Estética", 
                                "Compras", "Mercado", "Fixos", "Terceiros"
                            ], 
                            bancos: ["Cadastre seus cartões!"],
                            detalhesBancos: [
                                { nome: "Cadastre seus cartões!", fechamento: 10, vencimento: 20 }
                            ]
                        },
                        entradas: [], transacoes: [], metas: []
                    };
                    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
                    await window.setDoc(userDoc, { dados: salsiData });
                }

            } catch (error) {
                console.error("Erro ao baixar dados do Firebase:", error);
                alert("Erro de conexão com o servidor. Tente recarregar a página.");
                if (splashLoader) splashLoader.style.display = 'none';
                return; // Interrompe para não carregar a tela pela metade
            }

            // Tudo seguro! Libera a tela
            if (splashLoader) splashLoader.style.display = 'none';
            iniciar(); 

			const userRef = window.doc(window.db, 'usuarios', user.uid);
            window.onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const dados = docSnap.data();
                    let convitesUsados = dados.convitesUsados || 0;
                    
                    const badgeContador = document.getElementById('contador-convites');
                    const btnConvite = document.getElementById('btn-gerar-convite');

                    if (badgeContador) {
                        let displayCount = convitesUsados > 3 ? 3 : convitesUsados;
                        badgeContador.innerText = `${displayCount}/3 Convites`;
                        
                        if (convitesUsados >= 3 && btnConvite) {
                            btnConvite.innerText = "Convites Esgotados 🎉";
                            btnConvite.style.background = "#3f3f46";
                            btnConvite.style.cursor = "default";
                            btnConvite.onclick = null;
                        }
                    }
                }
            });
            
        } else {
            // --- SE NÃO TIVER LOGADO --- 
            localStorage.removeItem('salsifin_cache');
            salsiData = { config: { categorias: [], bancos: [], detalhesBancos: [] }, entradas: [], transacoes: [], metas: [] };

            authScreen.style.display = 'flex';
            
            const splashLoader = document.getElementById('auth-splash-loader');
            if (splashLoader) splashLoader.style.display = 'none';
            
            const authLeft = document.querySelector('.auth-left');
            const authRight = document.getElementById('auth-showcase');
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            
            if (window.innerWidth <= 1024) {
                if (authLeft) authLeft.style.display = 'none';
                if (authRight) authRight.style.display = 'flex';
                if (loginForm) loginForm.style.display = 'none';
                if (registerForm) registerForm.style.display = 'none';
            } else {
                if (authLeft) authLeft.style.display = 'flex';
                if (authRight) authRight.style.display = 'flex';
                if (loginForm) loginForm.style.display = 'block';
                if (registerForm) registerForm.style.display = 'none';
            }
            
            iniciarSliderAuth(); 
        }
    });
};

async function salvarNoFirebase() {
    // 1. Sempre salva no PC (pra ficar rápido)
    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));

    // 2. A trava entra em ação aqui: Tem alguém logado de verdade?
    if (!window.auth || !window.auth.currentUser || isSincronizando) {
        return; // Corta a função aqui e proíbe ir pra nuvem!
    }

    const uid = window.auth.currentUser.uid;
    const userDoc = window.doc(window.db, "usuarios", uid);

    // 3. Salva exclusivamente na gaveta do usuário logado
    try {
        await window.setDoc(userDoc, { dados: salsiData });
        console.log("Dados salvos na nuvem com segurança!");
    } catch (e) {
        console.error("Erro ao salvar na nuvem: ", e);
    }
}

// Função para trocar entre Login e Cadastro
function toggleAuth(isRegister) {
    console.log("Trocando tela para registro:", isRegister);
    document.getElementById('login-form').style.display = isRegister ? 'none' : 'block';
    document.getElementById('register-form').style.display = isRegister ? 'block' : 'none';
}

// --- FUNÇÃO DO OLHINHO DA SENHA ---
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fi-rr-eye', 'fi-rr-eye-crossed');
    } else {
        input.type = 'password';
        icon.classList.replace('fi-rr-eye-crossed', 'fi-rr-eye');
    }
}

// --- FUNÇÃO DA SAUDAÇÃO (PC E MOBILE) ATUALIZADA ---
function atualizarSaudacao(nomeCompleto) {
    if (!nomeCompleto) return;
    
    const primeiroNome = nomeCompleto.split(' ')[0];
    const hora = new Date().getHours();
    let saudacaoRandom = "";

    if (hora >= 5 && hora < 12) {
        const opcoes = ["Bom dia", "Ótima manhã", "Eaí"];
        saudacaoRandom = opcoes[Math.floor(Math.random() * opcoes.length)];
    } else if (hora >= 12 && hora < 18) {
        const opcoes = ["Boa tarde", "Eaí", "Olá"];
        saudacaoRandom = opcoes[Math.floor(Math.random() * opcoes.length)];
    } else {
        const opcoes = ["Boa noite", "Eaí", "Olá"];
        saudacaoRandom = opcoes[Math.floor(Math.random() * opcoes.length)];
    }

    const htmlBasePC = `
    <div class="greeting-desktop-wrapper">
        <div class="greeting-desktop-title">
            <span class="greet-light">${saudacaoRandom},</span>
            <span class="greet-bold">${primeiroNome}!</span>
        </div>

        <button 
            type="button" 
            class="privacy-toggle-btn privacy-toggle-desktop" 
            onclick="alternarPrivacidadeValores()" 
            title="Ocultar valores"
            aria-label="Ocultar valores"
        >
            <i class="fi fi-rr-eye"></i>
        </button>

        <button type="button" class="guget-ai-trigger guget-ai-trigger-desktop desktop-only" onclick="abrirAssistente()">
            <span class="guget-ai-icon">✨</span>
            <span class="guget-ai-text">Me pergunte algo...</span>
        </button>
    </div>
`;

    const htmlBaseMobile = `
    <div class="greeting-mobile-wrapper">
        <div class="greeting-title-wrapper-mobile">
            <span class="greet-light">${saudacaoRandom},</span>
            <span class="greet-bold">${primeiroNome}!</span>

            <button 
                type="button" 
                class="privacy-toggle-btn privacy-toggle-mobile" 
                onclick="alternarPrivacidadeValores()" 
                title="Ocultar valores"
                aria-label="Ocultar valores"
            >
                <i class="fi fi-rr-eye"></i>
            </button>
        </div>

        <button type="button" class="guget-ai-trigger guget-ai-trigger-mobile mobile-only" onclick="abrirAssistente()">
            <span class="guget-ai-icon">✨</span>
            <span class="guget-ai-text">Me pergunte algo...</span>
        </button>
    </div>
`;

    const containerPC = document.getElementById('greeting-pc');
    if (containerPC) {
        containerPC.innerHTML = htmlBasePC;
        containerPC.style.display = 'block';
    }

    const containerMobile = document.getElementById('greeting-mobile');
    if (containerMobile) {
        containerMobile.innerHTML = htmlBaseMobile;
    }
}

// --- FUNÇÕES DO PERFIL ---
function abrirModalPerfil() {
    const user = window.auth.currentUser;
    if (user) {
        document.getElementById('perfil-nome').value = user.displayName || '';
        document.getElementById('perfil-email').value = user.email || '';
        document.getElementById('perfil-senha').value = ''; // Sempre limpo por segurança
        
        // 👇 NOVO: Carrega a preferência da IA 👇
        const modoIA = (salsiData.config && salsiData.config.modoIA) ? salsiData.config.modoIA : 'calendario';
        const selectModo = document.getElementById('perfil-modo-ia');
        if (selectModo) selectModo.value = modoIA;

        document.getElementById('modal-perfil').showModal();
        
        // Fecha o menu cascata
        document.getElementById('menu-dropdown').classList.remove('active');
    }
}

async function salvarPerfil() {
    const user = window.auth.currentUser;
    if (!user) return;

    const novoNome = document.getElementById('perfil-nome').value.trim();
    const novoEmail = document.getElementById('perfil-email').value.trim();
    const novaSenha = document.getElementById('perfil-senha').value;
    const btn = document.querySelector('#modal-perfil button');
    
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        let atualizouAlgo = false;

        // 1. Atualiza o nome se foi alterado
        if (novoNome && novoNome !== user.displayName) {
            await window.updateProfile(user, { displayName: novoNome });
            atualizarSaudacao(novoNome); // Atualiza a tela na hora
            atualizouAlgo = true;
        }

        // 2. Atualiza o e-mail se foi alterado
        if (novoEmail && novoEmail !== user.email) {
            await window.updateEmail(user, novoEmail);
            atualizouAlgo = true;
        }

        // 3. Atualiza a senha se ele digitou algo
        if (novaSenha) {
            if (novaSenha.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
            await window.updatePassword(user, novaSenha);
            atualizouAlgo = true;
        }

        // 👇 NOVO: Salva a preferência da IA 👇
        const novoModoIA = document.getElementById('perfil-modo-ia').value;
        if (!salsiData.config) salsiData.config = {};
        if (salsiData.config.modoIA !== novoModoIA) {
            salsiData.config.modoIA = novoModoIA;
            atualizouAlgo = true;
            localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
            if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
        }

        if (atualizouAlgo) {
            alert("Perfil atualizado com sucesso!");
        }
        
        document.getElementById('perfil-senha').value = ''; // Limpa o campo de senha
        document.getElementById('modal-perfil').close();

    } catch (error) {
        console.error("Erro no perfil:", error);
        
        // Trata o erro de segurança do Firebase (Precisa logar de novo para ações sensíveis)
        if (error.code === 'auth/requires-recent-login') {
            alert("🔐 Por segurança, o servidor exige que você tenha feito login recentemente para alterar e-mail ou senha.\n\nPor favor, saia da sua conta, entre novamente e tente fazer a alteração.");
        } else if (error.code === 'auth/email-already-in-use') {
            alert("Este endereço de e-mail já está sendo usado por outra conta.");
        } else if (error.code === 'auth/invalid-email') {
            alert("O formato do e-mail é inválido.");
        } else {
            alert("Erro ao atualizar: " + error.message);
        }
    } finally {
        btn.innerText = "Salvar Alterações";
        btn.disabled = false;
    }
}

// --- FUNÇÃO PARA SAIR DA CONTA COM SEGURANÇA ---
async function sairDaConta() {
    // 👇 NOVA TRAVA DE SEGURANÇA 👇
    if (confirm("Tem certeza que deseja sair da sua conta? 👋")) {
        try {
            await window.signOut(window.auth);
            
            // 1. Limpa o cache do navegador
            localStorage.removeItem('salsifin_cache');
            
            // 2. Esvazia a variável da memória
            salsiData = null; 
            
            // 3. Força a página a recarregar limpa (F5)
            location.reload(); 
        } catch (error) {
            console.error("Erro ao sair:", error);
        }
    }
}

// --- FUNÇÃO DO TOAST DE NOTIFICAÇÃO ---
let toastTimeout; // Variável para controlar o tempo

function mostrarToast(mensagem) {
    const toast = document.getElementById('toast-notificacao');
    const toastMsg = document.getElementById('toast-mensagem');

    if (toast && toastMsg) {
        toastMsg.innerText = mensagem; // Define o texto que você enviou
        toast.classList.add('mostrar'); // Faz a notificação subir na tela

        // Limpa o timer anterior (caso o usuário clique várias vezes rápido)
        clearTimeout(toastTimeout);

        // Depois de 3 segundos (3000ms), ele remove a classe e a notificação desce
        toastTimeout = setTimeout(() => {
            toast.classList.remove('mostrar');
        }, 3000); 
    }
}

// --- SISTEMA DA TELA DE BOAS VINDAS E SLIDER ---
let slideInterval;

function iniciarSliderAuth() {
    const container = document.getElementById('slides-container');
    const dots = document.querySelectorAll('.slider-dots .dot');
    if (!container || dots.length === 0) return;

    let indexAtual = 0;
    const totalSlides = dots.length;

    // Atualiza a bolinha ativa se o usuário arrastar com o dedo
    container.addEventListener('scroll', () => {
        const scrollLeft = container.scrollLeft;
        const width = container.offsetWidth;
        indexAtual = Math.round(scrollLeft / width);
        
        dots.forEach(d => d.classList.remove('active'));
        if (dots[indexAtual]) dots[indexAtual].classList.add('active');
    }, { passive: true });

    // Autoplay: muda de slide a cada 4 segundos
    clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        indexAtual = (indexAtual + 1) % totalSlides;
        const width = container.offsetWidth;
        container.scrollTo({ left: width * indexAtual, behavior: 'smooth' });
    }, 4000);
}

// Quando o usuário clica em "Get Started" ou "Sign in" no celular
function mostrarFormulario(tipo) {
    if (window.innerWidth <= 1024) {
        // No celular, esconde o slide e mostra o lado esquerdo (formulários)
        document.getElementById('auth-showcase').style.display = 'none';
        
        const authLeft = document.querySelector('.auth-left');
        if (authLeft) authLeft.style.display = 'flex';
        
        // Para o slider de rodar no fundo para economizar bateria
        clearInterval(slideInterval); 
    }
    
    // Aproveita a sua função nativa que alterna entre Login e Cadastro
    toggleAuth(tipo === 'register'); 
}

function toggleInputsDebito() {
    const isDebito = document.getElementById('banco-apenas-debito').checked;
    const boxDatas = document.getElementById('box-datas-cartao');
    
    // 👇 AQUI ESTAVA O ERRO ANTES! AGORA ESTÃO COM OS IDs CORRETOS 👇
    const inputFechamento = document.getElementById('nc-fechamento');
    const inputVencimento = document.getElementById('nc-vencimento');

    if (isDebito) {
        if (boxDatas) {
            boxDatas.style.opacity = '0.3';
            boxDatas.style.pointerEvents = 'none'; // Impede o clique
        }
        if (inputFechamento) inputFechamento.value = ''; // Limpa se tinha algo
        if (inputVencimento) inputVencimento.value = '';
    } else {
        if (boxDatas) {
            boxDatas.style.opacity = '1';
            boxDatas.style.pointerEvents = 'auto'; // Libera o clique
        }
    }
}

// --- FUNÇÃO PARA RECUPERAR SENHA ---
async function recuperarSenha() {
    const email = document.getElementById('login-email').value.trim();
    
    if (!email) {
        alert("Por favor, digite seu e-mail no campo acima para receber o link de recuperação.");
        document.getElementById('login-email').focus();
        return;
    }

    try {
        await window.sendPasswordResetEmail(window.auth, email);
        alert(`E-mail de redefinição enviado para ${email}!\n\nVerifique sua caixa de entrada e também a pasta de Spam.`);
    } catch (error) {
        console.error("Erro ao enviar recuperação:", error);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
            alert("Não encontramos nenhuma conta com este e-mail.");
        } else {
            alert("Erro ao tentar recuperar a senha: " + error.message);
        }
    }
}

