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

async function fazerLoginGoogle() {
    const loader = document.getElementById('auth-splash-loader');
    const loginForm = document.getElementById('login-form');

    if (!window.GoogleAuthProvider || !window.signInWithPopup) {
        alert('Login com Google ainda não está disponível neste ambiente.');
        return;
    }

    try {
        if (loginForm) loginForm.style.display = 'none';
        if (loader) loader.style.display = 'block';

        const provider = new window.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        const resultado = await window.signInWithPopup(window.auth, provider);
        const user = resultado.user;

        const userDoc = window.doc(window.db, 'usuarios', user.uid);
        const docSnap = await window.getDoc(userDoc);

        if (!docSnap.exists() || !docSnap.data().dados) {
            if (window.deleteUser) {
                await window.deleteUser(user).catch(() => null);
            }

            await window.signOut(window.auth);

            if (!window.alertGoogleSemContaExibido) {
                window.alertGoogleSemContaExibido = true;
                alert('Esta conta Google ainda não está conectada a uma conta Guget Fin. Cadastre-se com e-mail e senha primeiro ou entre na sua conta e conecte o Google em Configurações.');
                setTimeout(() => { window.alertGoogleSemContaExibido = false; }, 1000);
            }

            if (loader) loader.style.display = 'none';
            if (loginForm) loginForm.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro no login Google:', error);
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            // Usuário apenas fechou a janela do Google.
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            alert('Esse e-mail já possui uma conta com senha. Entre com e-mail e senha e conecte o Google em Configurações.');
        } else {
            alert('Erro ao entrar com Google: ' + error.message);
        }

        if (loader) loader.style.display = 'none';
        if (loginForm) loginForm.style.display = 'block';
    }
}

// Função de Registro Real (Mantenha apenas ESTA versão)
async function fazerCadastro() {
    try {
        const nome = document.getElementById('register-nome').value.trim();
        const sobrenome = document.getElementById('register-sobrenome')?.value.trim() || '';
        const username = normalizarUsernamePerfil(document.getElementById('register-username')?.value || '');
        const email = document.getElementById('register-email').value.trim().toLowerCase();
        const emailConf = document.getElementById('register-email-conf')?.value.trim().toLowerCase() || '';
        const senha = document.getElementById('register-senha').value;
        const senhaConf = document.getElementById('register-senha-conf').value;
        const nomeCompleto = [nome, sobrenome].filter(Boolean).join(' ').trim();
        
        const loader = document.getElementById('auth-splash-loader'); 
        const form = document.getElementById('register-form');

        if (!nome || !sobrenome || !username || !email || !emailConf || !senha || !senhaConf) {
            alert("Preencha todos os campos!");
            return;
        }
        if (username.length < 3) {
            alert("O user precisa ter pelo menos 3 caracteres.");
            return;
        }
        if (email !== emailConf) {
            alert("A confirmação de e-mail não bate.");
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
        await validarUsernameDisponivelCadastro(username);

        const userCredential = await window.createUserWithEmailAndPassword(window.auth, email, senha);
        await window.updateProfile(userCredential.user, { displayName: nomeCompleto });

        const perfilPublico = {
            uid: userCredential.user.uid,
            nome: nomeCompleto,
            username,
            usernameBusca: username,
            avatar: userCredential.user.photoURL || '',
            atualizadoEm: new Date().toISOString()
        };

        salsiData = criarEstruturaInicialUsuario(nome, sobrenome, username, email);
        await reservarUsernameUnico(username, '', perfilPublico, true);
        await window.setDoc(
            window.doc(window.db, 'usuarios', userCredential.user.uid),
            { dados: salsiData, perfilPublico },
            { merge: true }
        );
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
		
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
                    const entrouSoComGoogle = user.providerData.some(provider => provider.providerId === 'google.com')
                        && !user.providerData.some(provider => provider.providerId === 'password');

                    if (entrouSoComGoogle) {
                        if (window.deleteUser) {
                            await window.deleteUser(user).catch(() => null);
                        }

                        await window.signOut(window.auth);

                        if (!window.alertGoogleSemContaExibido) {
                            window.alertGoogleSemContaExibido = true;
                            alert('Esta conta Google ainda não está conectada a uma conta Guget Fin. Cadastre-se com e-mail e senha primeiro ou conecte o Google em Configurações.');
                            setTimeout(() => { window.alertGoogleSemContaExibido = false; }, 1000);
                        }

                        return;
                    }

                    // SE É CONTA NOVA ZERADA: Cria a estrutura inicial perfeita
                    console.log("Usuário novo! Criando estrutura inicial...");
                    const partesNome = obterPartesNomePerfil(user.displayName || '');
                    salsiData = criarEstruturaInicialUsuario(partesNome.nome, partesNome.sobrenome, '', user.email || '');
                    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
                    await window.setDoc(userDoc, { dados: salsiData }, { merge: true });
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
            if (typeof carregarConfiguracoesPerfil === 'function') {
                carregarConfiguracoesPerfil();
            }

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
            document.body.classList.remove('dark-theme');
            if (typeof atualizarBotaoTemaTopo === 'function') atualizarBotaoTemaTopo(false);

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
    const perfil = salsiData?.config?.perfil || {};
    const username = normalizarUsernamePerfil(perfil.username || '');
    const nomePublico = [perfil.nome, perfil.sobrenome].filter(Boolean).join(' ').trim()
        || window.auth.currentUser.displayName
        || 'Usuario';
    const perfilPublico = montarPerfilPublicoUsuario(username, nomePublico, perfil.avatar || '');

    if (username) {
        try {
            await reservarUsernameUnico(username, username, perfilPublico, false);
        } catch (indexError) {
            console.warn("Não foi possível atualizar o índice público de username:", indexError);
        }
    }

    // 3. Salva exclusivamente na gaveta do usuário logado
    try {
        await window.setDoc(userDoc, { dados: salsiData, perfilPublico }, { merge: true });
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
    if (typeof irParaConfiguracoes === 'function') {
        irParaConfiguracoes('perfil');
        return;
    }

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

function obterPartesNomePerfil(nomeCompleto) {
    const partes = String(nomeCompleto || '').trim().split(/\s+/).filter(Boolean);

    return {
        nome: partes[0] || '',
        sobrenome: partes.slice(1).join(' ')
    };
}

function obterPerfilConfig() {
    if (!salsiData.config) salsiData.config = {};
    if (!salsiData.config.perfil) salsiData.config.perfil = {};

    return salsiData.config.perfil;
}

function normalizarUsernamePerfil(username) {
    return String(username || '')
        .trim()
        .replace(/^@+/, '')
        .toLowerCase()
        .replace(/[^a-z0-9._]/g, '');
}

async function validarUsernameDisponivelCadastro(username) {
    const usernameLimpo = normalizarUsernamePerfil(username);
    if (!usernameLimpo || !window.doc || !window.getDoc) return;

    const ref = window.doc(window.db, 'usernames', usernameLimpo);
    const snap = await window.getDoc(ref);

    if (snap.exists()) {
        throw new Error(`O @${usernameLimpo} já está em uso.`);
    }
}

function criarEstruturaInicialUsuario(nome = '', sobrenome = '', username = '', email = '') {
    return {
        config: {
            perfil: {
                nome,
                sobrenome,
                username,
                email,
                profissao: '',
                atualizadoEm: new Date().toISOString()
            },
            categorias: [
                "Alimentação", "Assinaturas", "Lazer", "Outros",
                "Transporte", "Presentes", "Saúde/Estética",
                "Compras", "Mercado", "Fixos", "Terceiros", "Caixinha"
            ],
            bancos: ["Cadastre seus cartões!"],
            detalhesBancos: [
                { nome: "Cadastre seus cartões!", fechamento: 10, vencimento: 20 }
            ]
        },
        entradas: [],
        transacoes: [],
        metas: [],
        caixinha: []
    };
}

function normalizarCampoUsernamePerfil(input) {
    if (!input) return;

    const normalizado = normalizarUsernamePerfil(input.value);
    input.value = normalizado ? `@${normalizado}` : '';
}

function montarPerfilPublicoUsuario(username, nomePublico, avatar = '') {
    const user = window.auth?.currentUser;

    return {
        uid: user?.uid || '',
        nome: nomePublico || user?.displayName || 'Usuario',
        username,
        usernameBusca: username,
        avatar: user?.photoURL || avatar || '',
        atualizadoEm: new Date().toISOString()
    };
}

async function reservarUsernameUnico(username, usernameAnterior, perfilPublico, bloquearDuplicado = true) {
    if (!username || !window.auth?.currentUser || !window.doc || !window.getDoc || !window.setDoc) return;

    const uid = window.auth.currentUser.uid;
    const usernameLimpo = normalizarUsernamePerfil(username);
    const usernameAntigo = normalizarUsernamePerfil(usernameAnterior || '');
    const novoRef = window.doc(window.db, 'usernames', usernameLimpo);

    const dadosIndice = {
        uid,
        nome: perfilPublico.nome,
        username: usernameLimpo,
        usernameBusca: usernameLimpo,
        avatar: perfilPublico.avatar || '',
        atualizadoEm: window.serverTimestamp ? window.serverTimestamp() : new Date().toISOString()
    };

    const erroDuplicado = () => new Error(`O @${usernameLimpo} já está em uso.`);

    if (window.runTransaction) {
        await window.runTransaction(window.db, async (transaction) => {
            const novoSnap = await transaction.get(novoRef);

            if (novoSnap.exists() && novoSnap.data().uid !== uid) {
                if (bloquearDuplicado) throw erroDuplicado();
                return;
            }

            transaction.set(novoRef, dadosIndice, { merge: true });

            if (usernameAntigo && usernameAntigo !== usernameLimpo) {
                const antigoRef = window.doc(window.db, 'usernames', usernameAntigo);
                const antigoSnap = await transaction.get(antigoRef);

                if (antigoSnap.exists() && antigoSnap.data().uid === uid) {
                    transaction.delete(antigoRef);
                }
            }
        });

        return;
    }

    const snap = await window.getDoc(novoRef);
    if (snap.exists() && snap.data().uid !== uid) {
        if (bloquearDuplicado) throw erroDuplicado();
        return;
    }

    await window.setDoc(novoRef, dadosIndice, { merge: true });

    if (usernameAntigo && usernameAntigo !== usernameLimpo && window.deleteDoc) {
        const antigoRef = window.doc(window.db, 'usernames', usernameAntigo);
        const antigoSnap = await window.getDoc(antigoRef);

        if (antigoSnap.exists() && antigoSnap.data().uid === uid) {
            await window.deleteDoc(antigoRef);
        }
    }
}

async function removerUsernameReservado(username) {
    const usernameLimpo = normalizarUsernamePerfil(username || '');
    if (!usernameLimpo || !window.auth?.currentUser || !window.doc || !window.getDoc || !window.deleteDoc) return;

    const ref = window.doc(window.db, 'usernames', usernameLimpo);
    const snap = await window.getDoc(ref);

    if (snap.exists() && snap.data().uid === window.auth.currentUser.uid) {
        await window.deleteDoc(ref);
    }
}

function carregarConfiguracoesPerfil() {
    const user = window.auth && window.auth.currentUser;
    if (!user) return;

    const perfil = obterPerfilConfig();
    const nomeFirebase = obterPartesNomePerfil(user.displayName || '');
    const nome = perfil.nome || nomeFirebase.nome;
    const sobrenome = perfil.sobrenome || nomeFirebase.sobrenome;
    const username = normalizarUsernamePerfil(perfil.username || '');
    const profissao = perfil.profissao || '';
    const avatarPadrao = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    const avatar = user.photoURL || perfil.avatar || avatarPadrao;

    const campos = {
        'settings-profile-first-name': nome,
        'settings-profile-last-name': sobrenome,
        'settings-profile-username': username ? `@${username}` : '',
        'settings-profile-profession': profissao
    };

    Object.entries(campos).forEach(([id, valor]) => {
        const el = document.getElementById(id);
        if (el) el.value = valor;
    });

    const nomeCompleto = [nome, sobrenome].filter(Boolean).join(' ') || user.displayName || 'Usuario';
    const settingsName = document.getElementById('settings-user-name');
    const settingsEmail = document.getElementById('settings-user-email');
    const securityEmail = document.getElementById('settings-security-current-email');
    const profileAvatar = document.getElementById('settings-profile-avatar-preview');
    const settingsAvatar = document.getElementById('settings-avatar-img');
    const headerAvatar = document.getElementById('header-avatar-img');

    if (settingsName) settingsName.textContent = nomeCompleto;
    if (settingsEmail) settingsEmail.textContent = user.email || '';
    if (securityEmail) securityEmail.textContent = user.email || '';
    if (profileAvatar) profileAvatar.src = avatar;
    if (settingsAvatar) settingsAvatar.src = avatar;
    if (headerAvatar) headerAvatar.src = avatar;

    const modoIA = salsiData.config?.modoIA || 'calendario';
    const selectModoAntigo = document.getElementById('perfil-modo-ia');
    const selectModoNovo = document.getElementById('settings-modo-ia');
    if (selectModoAntigo) selectModoAntigo.value = modoIA;
    if (selectModoNovo) selectModoNovo.value = modoIA;

    const temaEscuro = (salsiData.config?.tema || 'light') === 'dark';
    const themeToggleAntigo = document.getElementById('theme-toggle');
    const themeToggleNovo = document.getElementById('settings-theme-toggle');
    if (themeToggleAntigo) themeToggleAntigo.checked = temaEscuro;
    if (themeToggleNovo) themeToggleNovo.checked = temaEscuro;

    atualizarStatusGoogleConta();
}

function obterConexaoGoogleUsuario(user = window.auth?.currentUser) {
    if (!user || !Array.isArray(user.providerData)) return null;
    return user.providerData.find(provider => provider.providerId === 'google.com') || null;
}

function atualizarStatusGoogleConta() {
    const user = window.auth?.currentUser;
    const googleProvider = obterConexaoGoogleUsuario(user);
    const estaConectado = !!googleProvider;

    const pill = document.getElementById('settings-google-status-pill');
    const statusText = document.getElementById('settings-google-status-text');
    const emailEl = document.getElementById('settings-google-email');
    const btnConnect = document.getElementById('btn-connect-google');
    const btnDisconnect = document.getElementById('btn-disconnect-google');

    if (pill) {
        pill.textContent = estaConectado ? 'Conectado' : 'Não conectado';
        pill.classList.toggle('is-connected', estaConectado);
    }

    if (statusText) {
        statusText.textContent = estaConectado
            ? 'Google conectado para login rápido.'
            : 'Conecte sua conta Google para entrar com um clique.';
    }

    if (emailEl) {
        emailEl.textContent = estaConectado
            ? (googleProvider.email || 'Conta Google vinculada.')
            : 'Nenhuma conta Google vinculada.';
    }

    if (btnConnect) btnConnect.style.display = estaConectado ? 'none' : 'inline-flex';
    if (btnDisconnect) btnDisconnect.style.display = estaConectado ? 'inline-flex' : 'none';
}

function criarGoogleProviderConta() {
    const provider = new window.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
}

async function conectarGoogleConta() {
    const user = window.auth?.currentUser;
    const btn = document.getElementById('btn-connect-google');

    if (!user) return;

    if (!window.GoogleAuthProvider || !window.linkWithPopup) {
        alert('Conexão com Google ainda não está disponível neste ambiente.');
        return;
    }

    if (obterConexaoGoogleUsuario(user)) {
        alert('Sua conta Google já está conectada.');
        atualizarStatusGoogleConta();
        return;
    }

    try {
        if (btn) {
            btn.innerText = 'Conectando...';
            btn.disabled = true;
        }

        const resultado = await window.linkWithPopup(user, criarGoogleProviderConta());
        if (resultado.user.reload) await resultado.user.reload();
        const googleProvider = obterConexaoGoogleUsuario(resultado.user);

        if (!salsiData.config) salsiData.config = {};
        salsiData.config.googleConectado = true;
        salsiData.config.googleEmail = googleProvider?.email || '';
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();

        atualizarStatusGoogleConta();
        mostrarToast('Google conectado com sucesso.');
    } catch (error) {
        console.error('Erro ao conectar Google:', error);

        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            // Usuário apenas fechou a janela do Google.
        } else if (error.code === 'auth/credential-already-in-use') {
            alert('Essa conta Google já está conectada a outro usuário.');
        } else if (error.code === 'auth/provider-already-linked') {
            alert('Sua conta Google já está conectada.');
            atualizarStatusGoogleConta();
        } else if (error.code === 'auth/requires-recent-login') {
            alert('Por segurança, entre novamente na conta e tente conectar o Google.');
        } else {
            alert('Não foi possível conectar o Google: ' + error.message);
        }
    } finally {
        if (btn) {
            btn.innerText = 'Conectar Google';
            btn.disabled = false;
        }
    }
}

async function desconectarGoogleConta() {
    const user = window.auth?.currentUser;
    const btn = document.getElementById('btn-disconnect-google');

    if (!user) return;

    if (!window.unlink) {
        alert('Desconexão com Google ainda não está disponível neste ambiente.');
        return;
    }

    if (!obterConexaoGoogleUsuario(user)) {
        alert('Nenhuma conta Google está conectada.');
        atualizarStatusGoogleConta();
        return;
    }

    const temSenha = user.providerData.some(provider => provider.providerId === 'password');
    if (!temSenha) {
        alert('Antes de desconectar o Google, cadastre uma senha para não perder o acesso à conta.');
        return;
    }

    if (!confirm('Desconectar o Google desta conta? Você ainda poderá entrar com e-mail e senha.')) {
        return;
    }

    try {
        if (btn) {
            btn.innerText = 'Desconectando...';
            btn.disabled = true;
        }

        await window.unlink(user, 'google.com');
        if (user.reload) await user.reload();

        if (!salsiData.config) salsiData.config = {};
        salsiData.config.googleConectado = false;
        salsiData.config.googleEmail = '';
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();

        atualizarStatusGoogleConta();
        mostrarToast('Google desconectado da conta.');
    } catch (error) {
        console.error('Erro ao desconectar Google:', error);

        if (error.code === 'auth/requires-recent-login') {
            alert('Por segurança, entre novamente na conta e tente desconectar o Google.');
        } else if (error.code === 'auth/no-such-provider') {
            alert('Essa conta Google já não está mais conectada.');
            atualizarStatusGoogleConta();
        } else {
            alert('Não foi possível desconectar o Google: ' + error.message);
        }
    } finally {
        if (btn) {
            btn.innerText = 'Desconectar';
            btn.disabled = false;
        }
    }
}

function salvarPreferenciasApp() {
    if (!salsiData.config) salsiData.config = {};

    const selectModoNovo = document.getElementById('settings-modo-ia');
    const selectModoAntigo = document.getElementById('perfil-modo-ia');
    const novoModoIA = selectModoNovo ? selectModoNovo.value : 'calendario';

    salsiData.config.modoIA = novoModoIA;
    if (selectModoAntigo) selectModoAntigo.value = novoModoIA;

    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
    if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
}

const avatarPadraoPerfil = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
const avatarCropState = {
    fileName: 'avatar.jpg',
    dataUrl: '',
    naturalWidth: 0,
    naturalHeight: 0,
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
    isDragging: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0
};

function atualizarPreviewAvatarPerfil(url) {
    const finalUrl = url || avatarPadraoPerfil;
    const ids = [
        'settings-profile-avatar-preview',
        'settings-avatar-img',
        'header-avatar-img'
    ];

    ids.forEach(id => {
        const img = document.getElementById(id);
        if (img) img.src = finalUrl;
    });
}

function inicializarUploadAvatarPerfil() {
    const input = document.getElementById('settings-avatar-input');
    const stage = document.getElementById('avatar-crop-stage');
    const zoom = document.getElementById('avatar-crop-zoom');

    if (input && !input.dataset.avatarReady) {
        input.dataset.avatarReady = 'true';
        input.addEventListener('change', abrirCorteAvatarSelecionado);
    }

    if (zoom && !zoom.dataset.avatarReady) {
        zoom.dataset.avatarReady = 'true';
        zoom.addEventListener('input', () => {
            avatarCropState.zoom = parseFloat(zoom.value) || 1;
            aplicarTransformAvatarCrop();
        });
    }

    if (stage && !stage.dataset.avatarReady) {
        stage.dataset.avatarReady = 'true';
        stage.addEventListener('pointerdown', iniciarArrasteAvatar);
        stage.addEventListener('pointermove', moverArrasteAvatar);
        stage.addEventListener('pointerup', finalizarArrasteAvatar);
        stage.addEventListener('pointercancel', finalizarArrasteAvatar);
        stage.addEventListener('wheel', ajustarZoomAvatarComScroll, { passive: false });
    }
}

function abrirCorteAvatarSelecionado(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Escolha uma imagem para usar como foto de perfil.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const imgTeste = new Image();
        imgTeste.onload = () => {
            avatarCropState.fileName = file.name || 'avatar.jpg';
            avatarCropState.dataUrl = reader.result;
            avatarCropState.naturalWidth = imgTeste.naturalWidth;
            avatarCropState.naturalHeight = imgTeste.naturalHeight;
            avatarCropState.offsetX = 0;
            avatarCropState.offsetY = 0;
            avatarCropState.zoom = 1;

            const cropImg = document.getElementById('avatar-crop-image');
            const zoom = document.getElementById('avatar-crop-zoom');

            if (cropImg) cropImg.src = avatarCropState.dataUrl;
            if (zoom) zoom.value = '1';

            prepararImagemAvatarCrop();
            document.getElementById('modal-cortar-avatar')?.showModal();
        };
        imgTeste.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function obterDimensoesBaseAvatar(stageSize = 280) {
    const aspect = avatarCropState.naturalWidth / avatarCropState.naturalHeight;

    if (aspect >= 1) {
        return {
            width: stageSize * aspect,
            height: stageSize
        };
    }

    return {
        width: stageSize,
        height: stageSize / aspect
    };
}

function prepararImagemAvatarCrop() {
    const img = document.getElementById('avatar-crop-image');
    if (!img || !avatarCropState.naturalWidth || !avatarCropState.naturalHeight) return;

    const base = obterDimensoesBaseAvatar();
    img.style.width = `${base.width}px`;
    img.style.height = `${base.height}px`;

    aplicarTransformAvatarCrop();
}

function limitarOffsetAvatar() {
    const stageSize = 280;
    const maskSize = 220;
    const base = obterDimensoesBaseAvatar(stageSize);
    const scaledWidth = base.width * avatarCropState.zoom;
    const scaledHeight = base.height * avatarCropState.zoom;
    const limiteX = Math.max(0, (scaledWidth - maskSize) / 2);
    const limiteY = Math.max(0, (scaledHeight - maskSize) / 2);

    avatarCropState.offsetX = Math.max(-limiteX, Math.min(limiteX, avatarCropState.offsetX));
    avatarCropState.offsetY = Math.max(-limiteY, Math.min(limiteY, avatarCropState.offsetY));
}

function aplicarTransformAvatarCrop() {
    const img = document.getElementById('avatar-crop-image');
    if (!img) return;

    limitarOffsetAvatar();

    img.style.transform = `translate(calc(-50% + ${avatarCropState.offsetX}px), calc(-50% + ${avatarCropState.offsetY}px)) scale(${avatarCropState.zoom})`;
}

function iniciarArrasteAvatar(event) {
    avatarCropState.isDragging = true;
    avatarCropState.startX = event.clientX;
    avatarCropState.startY = event.clientY;
    avatarCropState.startOffsetX = avatarCropState.offsetX;
    avatarCropState.startOffsetY = avatarCropState.offsetY;
    event.currentTarget.setPointerCapture(event.pointerId);
}

function moverArrasteAvatar(event) {
    if (!avatarCropState.isDragging) return;

    avatarCropState.offsetX = avatarCropState.startOffsetX + (event.clientX - avatarCropState.startX);
    avatarCropState.offsetY = avatarCropState.startOffsetY + (event.clientY - avatarCropState.startY);
    aplicarTransformAvatarCrop();
}

function finalizarArrasteAvatar(event) {
    avatarCropState.isDragging = false;
    if (event.currentTarget && event.pointerId) {
        try {
            event.currentTarget.releasePointerCapture(event.pointerId);
        } catch (e) {}
    }
}

function ajustarZoomAvatarComScroll(event) {
    event.preventDefault();

    const zoom = document.getElementById('avatar-crop-zoom');
    const delta = event.deltaY > 0 ? -0.06 : 0.06;
    avatarCropState.zoom = Math.max(1, Math.min(3, avatarCropState.zoom + delta));

    if (zoom) zoom.value = String(avatarCropState.zoom);
    aplicarTransformAvatarCrop();
}

function fecharModalCorteAvatar() {
    const modal = document.getElementById('modal-cortar-avatar');
    const input = document.getElementById('settings-avatar-input');

    if (modal && modal.open) modal.close();
    if (input) input.value = '';
}

function gerarBlobAvatarCortado() {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const stageSize = 280;
            const maskSize = 220;
            const outputSize = 320;
            const base = obterDimensoesBaseAvatar(stageSize);
            const escala = outputSize / maskSize;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = outputSize;
            canvas.height = outputSize;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, outputSize, outputSize);

            ctx.translate(
                outputSize / 2 + avatarCropState.offsetX * escala,
                outputSize / 2 + avatarCropState.offsetY * escala
            );
            ctx.scale(avatarCropState.zoom * escala, avatarCropState.zoom * escala);
            ctx.drawImage(img, -base.width / 2, -base.height / 2, base.width, base.height);

            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Nao foi possivel processar a imagem.'));
                    return;
                }

                resolve(new File([blob], avatarCropState.fileName.replace(/\.[^/.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                }));
            }, 'image/jpeg', 0.78);
        };
        img.onerror = () => reject(new Error('Nao foi possivel carregar a imagem selecionada.'));
        img.src = avatarCropState.dataUrl;
    });
}

async function subirAvatarParaImgBB(arquivoAvatar) {
    const apiKey = '9ce95a3c98b6a4e35865fb7cf8b535db';
    const formData = new FormData();
    formData.append('image', arquivoAvatar);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error ? data.error.message : 'Erro desconhecido ao enviar a foto.');
    }

    return data.data.url;
}

async function salvarFotoPerfilCortada() {
    const user = window.auth.currentUser;
    if (!user) return;

    const btn = document.getElementById('btn-save-avatar');
    const textoOriginal = btn ? btn.innerText : '';

    if (btn) {
        btn.innerText = 'Salvando...';
        btn.disabled = true;
    }

    try {
        const arquivoAvatar = await gerarBlobAvatarCortado();
        const avatarUrl = await subirAvatarParaImgBB(arquivoAvatar);

        await window.updateProfile(user, { photoURL: avatarUrl });

        const perfil = obterPerfilConfig();
        perfil.avatar = avatarUrl;
        perfil.avatarAtualizadoEm = new Date().toISOString();

        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();

        atualizarPreviewAvatarPerfil(avatarUrl);
        fecharModalCorteAvatar();
        mostrarToast('Foto de perfil atualizada.');
    } catch (error) {
        console.error('Erro ao salvar avatar:', error);
        alert('Erro ao salvar a foto: ' + error.message);
    } finally {
        if (btn) {
            btn.innerText = textoOriginal || 'Salvar foto';
            btn.disabled = false;
        }
    }
}

async function removerFotoPerfil() {
    const user = window.auth.currentUser;
    if (!user) return;

    if (!confirm('Remover a foto de perfil atual?')) return;

    try {
        await window.updateProfile(user, { photoURL: null });

        const perfil = obterPerfilConfig();
        perfil.avatar = '';
        perfil.avatarAtualizadoEm = new Date().toISOString();

        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();

        atualizarPreviewAvatarPerfil(avatarPadraoPerfil);
        mostrarToast('Foto de perfil removida.');
    } catch (error) {
        console.error('Erro ao remover avatar:', error);
        alert('Erro ao remover a foto: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', inicializarUploadAvatarPerfil);

async function salvarConfiguracoesPerfil() {
    const user = window.auth.currentUser;
    if (!user) return;

    const btn = document.getElementById('btn-save-settings-profile');
    const nome = (document.getElementById('settings-profile-first-name')?.value || '').trim();
    const sobrenome = (document.getElementById('settings-profile-last-name')?.value || '').trim();
    const username = normalizarUsernamePerfil(document.getElementById('settings-profile-username')?.value || '');
    const profissao = (document.getElementById('settings-profile-profession')?.value || '').trim();
    const nomeCompleto = [nome, sobrenome].filter(Boolean).join(' ').trim();

    if (!nomeCompleto) {
        alert('Informe pelo menos o nome do usuario.');
        return;
    }

    if (username && username.length < 3) {
        alert('O user precisa ter pelo menos 3 caracteres.');
        return;
    }

    if (btn) {
        btn.innerText = 'Salvando...';
        btn.disabled = true;
    }

    try {
        let atualizouAlgo = false;
        const perfil = obterPerfilConfig();
        const usernameAnterior = normalizarUsernamePerfil(perfil.username || '');
        const perfilPublico = montarPerfilPublicoUsuario(username, nomeCompleto, perfil.avatar || '');

        if (username) {
            await reservarUsernameUnico(username, usernameAnterior, perfilPublico, true);
        } else if (usernameAnterior) {
            await removerUsernameReservado(usernameAnterior);
        }

        if (nomeCompleto !== user.displayName) {
            await window.updateProfile(user, { displayName: nomeCompleto });
            atualizarSaudacao(nomeCompleto);
            atualizouAlgo = true;
        }

        perfil.nome = nome;
        perfil.sobrenome = sobrenome;
        perfil.username = username;
        perfil.profissao = profissao;
        perfil.atualizadoEm = new Date().toISOString();

        salvarPreferenciasApp();
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();

        carregarConfiguracoesPerfil();

        mostrarToast(atualizouAlgo ? 'Perfil atualizado com sucesso.' : 'Preferencias salvas.');
    } catch (error) {
        console.error("Erro no perfil:", error);

        alert("Erro ao atualizar: " + error.message);
    } finally {
        if (btn) {
            btn.innerText = 'Salvar perfil';
            btn.disabled = false;
        }
    }
}

async function reautenticarUsuarioComSenha(senhaAtual) {
    const user = window.auth.currentUser;

    if (!user || !user.email) {
        throw new Error('Nao foi possivel identificar o e-mail da conta atual.');
    }

    if (!senhaAtual) {
        throw new Error('Digite sua senha atual para continuar.');
    }

    const credential = window.EmailAuthProvider.credential(user.email, senhaAtual);
    await window.reauthenticateWithCredential(user, credential);

    return user;
}

function tratarErroSegurancaConta(error) {
    console.error('Erro de seguranca da conta:', error);

    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        alert('Senha atual incorreta. Confere e tenta novamente.');
    } else if (error.code === 'auth/too-many-requests') {
        alert('Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.');
    } else if (error.code === 'auth/email-already-in-use') {
        alert('Este endereco de e-mail ja esta sendo usado por outra conta.');
    } else if (error.code === 'auth/invalid-email') {
        alert('O formato do e-mail e invalido.');
    } else if (error.code === 'auth/requires-recent-login') {
        alert('Por seguranca, entre novamente na conta e tente outra vez.');
    } else {
        alert('Nao foi possivel concluir a alteracao: ' + error.message);
    }
}

async function solicitarAlteracaoEmail() {
    const user = window.auth.currentUser;
    if (!user) return;

    const btn = document.getElementById('btn-update-email');
    const novoEmail = (document.getElementById('settings-security-new-email')?.value || '').trim();
    const senhaAtual = document.getElementById('settings-security-email-password')?.value || '';

    if (!novoEmail) {
        alert('Informe o novo e-mail.');
        return;
    }

    if (novoEmail === user.email) {
        alert('Esse ja e o e-mail atual da conta.');
        return;
    }

    if (btn) {
        btn.innerText = 'Enviando...';
        btn.disabled = true;
    }

    try {
        await reautenticarUsuarioComSenha(senhaAtual);
        await window.verifyBeforeUpdateEmail(user, novoEmail);

        document.getElementById('settings-security-new-email').value = '';
        document.getElementById('settings-security-email-password').value = '';

        mostrarToast('Enviamos um link de verificacao para o novo e-mail.');
        alert('Pronto. Agora confirme o link enviado para o novo e-mail. Ate a confirmacao, o e-mail atual continua valendo para login.');
    } catch (error) {
        tratarErroSegurancaConta(error);
    } finally {
        if (btn) {
            btn.innerText = 'Enviar verificacao';
            btn.disabled = false;
        }
    }
}

async function alterarSenhaSegura() {
    const user = window.auth.currentUser;
    if (!user) return;

    const btn = document.getElementById('btn-update-password');
    const senhaAtual = document.getElementById('settings-security-current-password')?.value || '';
    const novaSenha = document.getElementById('settings-security-new-password')?.value || '';
    const confirmarSenha = document.getElementById('settings-security-confirm-password')?.value || '';

    if (!novaSenha || !confirmarSenha) {
        alert('Digite e confirme a nova senha.');
        return;
    }

    if (novaSenha.length < 6) {
        alert('A nova senha precisa ter pelo menos 6 caracteres.');
        return;
    }

    if (novaSenha !== confirmarSenha) {
        alert('A confirmacao da senha nao bate com a nova senha.');
        return;
    }

    if (btn) {
        btn.innerText = 'Atualizando...';
        btn.disabled = true;
    }

    try {
        await reautenticarUsuarioComSenha(senhaAtual);
        await window.updatePassword(user, novaSenha);

        document.getElementById('settings-security-current-password').value = '';
        document.getElementById('settings-security-new-password').value = '';
        document.getElementById('settings-security-confirm-password').value = '';

        mostrarToast('Senha atualizada com sucesso.');
        alert('Senha atualizada com sucesso.');
    } catch (error) {
        tratarErroSegurancaConta(error);
    } finally {
        if (btn) {
            btn.innerText = 'Salvar perfil';
            btn.disabled = false;
        }
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

        if ((novoEmail && novoEmail !== user.email) || novaSenha) {
            alert("Alteracao de e-mail e senha agora fica em Conta e seguranca, com confirmacao da senha atual.");
            const modalPerfil = document.getElementById('modal-perfil');
            if (modalPerfil && modalPerfil.open) modalPerfil.close();
            if (typeof irParaConfiguracoes === 'function') irParaConfiguracoes('seguranca');
            return;
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
        
        alert("Erro ao atualizar: " + error.message);
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

function toggleInputsDebitoConfiguracoes() {
    const checkbox = document.getElementById('settings-banco-apenas-debito');
    const isDebito = checkbox ? checkbox.checked : false;
    const boxDatas = document.getElementById('settings-box-datas-cartao');
    const inputFechamento = document.getElementById('settings-nc-fechamento');
    const inputVencimento = document.getElementById('settings-nc-vencimento');

    if (isDebito) {
        if (boxDatas) {
            boxDatas.style.opacity = '0.3';
            boxDatas.style.pointerEvents = 'none';
        }
        if (inputFechamento) inputFechamento.value = '';
        if (inputVencimento) inputVencimento.value = '';
    } else if (boxDatas) {
        boxDatas.style.opacity = '1';
        boxDatas.style.pointerEvents = 'auto';
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

