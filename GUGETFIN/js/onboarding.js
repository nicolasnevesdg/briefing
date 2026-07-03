import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD1HyxzZ-YFMMbMSIwBDDKfNWdCWHb07AY",
    authDomain: "guget-fin.firebaseapp.com",
    projectId: "guget-fin",
    storageBucket: "guget-fin.firebasestorage.app",
    messagingSenderId: "626285959649",
    appId: "1:626285959649:web:9b1006694a4d05fa899aa0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'pt-BR';
const db = getFirestore(app);

const categoriasBase = [
    "Alimentação", "Mercado", "Transporte", "Moradia", "Saúde/Estética",
    "Lazer", "Educação", "Trabalho", "Assinaturas", "Compras", "Fixos", "Outros"
];

let usuarioAtual = null;
let dadosUsuario = null;
let etapaAtual = 0;
let categoriasSelecionadas = new Set(categoriasBase);
let usernameDisponivel = null;
let usernameTimer = null;
let usernameToken = 0;
let eventosCamposConfigurados = false;

const totalEtapas = 6;
const parametrosUrl = new URLSearchParams(window.location.search);
const modoRevisao = parametrosUrl.get('rever') === '1';

// Evita qualquer piscada clara antes do Firebase preencher os dados.
if (document.body) {
    document.documentElement.classList.add('dark-theme', 'guget-fixed-dark-page');
    document.body.classList.add('dark-theme', 'guget-fixed-dark-page');
}

function qs(id) {
    return document.getElementById(id);
}

function setStatus(texto) {
    const el = qs('onboarding-status');
    if (el) el.textContent = texto;
}

function configurarSaidaDoOnboarding() {
    const botaoSair = qs('onboarding-exit');
    if (!botaoSair) return;
    botaoSair.style.display = modoRevisao ? 'inline-flex' : 'none';
}

function normalizarUsername(username) {
    return String(username || '')
        .trim()
        .replace(/^@+/, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9._]/g, '');
}

function normalizarCampoUsernameOnboarding(input) {
    if (!input) return;
    const normalizado = normalizarUsername(input.value);
    input.value = normalizado ? `@${normalizado}` : '';
    verificarUsernameOnboarding();
}

function setUsernameStatus(texto, estado = 'neutral') {
    const el = qs('onboarding-username-status');
    if (!el) return;
    el.textContent = texto;
    el.dataset.state = estado;
}

function usernameAnteriorAtual() {
    return normalizarUsername(dadosUsuario?.config?.perfil?.username || '');
}

function verificarUsernameOnboarding() {
    const username = normalizarUsername(qs('onboarding-username')?.value || '');
    clearTimeout(usernameTimer);

    if (!username) {
        usernameDisponivel = null;
        setUsernameStatus('Use apenas minúsculas, números, ponto ou underline.', 'neutral');
        atualizarBotoes();
        return;
    }

    if (username.length < 3) {
        usernameDisponivel = false;
        setUsernameStatus('Use pelo menos 3 caracteres.', 'error');
        atualizarBotoes();
        return;
    }

    const token = ++usernameToken;
    usernameDisponivel = null;
    setUsernameStatus('Verificando disponibilidade...', 'checking');
    atualizarBotoes();

    usernameTimer = setTimeout(async () => {
        try {
            const snap = await getDoc(doc(db, 'usernames', username));
            if (token !== usernameToken) return;

            if (snap.exists() && snap.data().uid !== usuarioAtual?.uid) {
                usernameDisponivel = false;
                setUsernameStatus(`@${username} já está em uso.`, 'error');
            } else {
                usernameDisponivel = true;
                setUsernameStatus(`@${username} disponível.`, 'success');
            }
        } catch (error) {
            console.error('Erro ao verificar @user:', error);
            if (token !== usernameToken) return;
            usernameDisponivel = false;
            setUsernameStatus('Não foi possível verificar este @ agora.', 'error');
        }

        atualizarBotoes();
    }, username === usernameAnteriorAtual() ? 0 : 360);
}

function configurarEventosCampos() {
    if (eventosCamposConfigurados) return;
    eventosCamposConfigurados = true;

    ['onboarding-first-name', 'onboarding-last-name', 'onboarding-profession'].forEach(id => {
        const el = qs(id);
        if (el) el.addEventListener('input', atualizarBotoes);
    });

    ['onboarding-card-close', 'onboarding-card-due'].forEach(id => {
        const el = qs(id);
        if (!el) return;
        el.addEventListener('input', () => {
            el.value = el.value.replace(/\D/g, '').slice(0, 2);
        });
    });

    ['onboarding-theme-start', 'onboarding-theme-end'].forEach(id => {
        const el = qs(id);
        if (el) el.addEventListener('change', atualizarTemaOnboarding);
    });
}

function atualizarModoCartaoOnboarding() {
    const isDebitoOnly = qs('onboarding-card-debit')?.checked === true;
    const form = document.querySelector('.onboarding-form-card');
    if (form) form.classList.toggle('is-debit-card', isDebitoOnly);

    document.querySelectorAll('.onboarding-credit-field input').forEach(input => {
        input.disabled = isDebitoOnly;
        if (isDebitoOnly) input.value = '';
    });
}

function obterRadioSelecionado(nome, fallback) {
    return document.querySelector(`input[name="${nome}"]:checked`)?.value || fallback;
}

function marcarRadio(nome, valor) {
    const radio = document.querySelector(`input[name="${nome}"][value="${valor}"]`);
    if (radio) radio.checked = true;
}

function horaParaMinutos(valor) {
    const [horas, minutos] = String(valor || '').split(':').map(Number);
    if (!Number.isFinite(horas) || !Number.isFinite(minutos)) return 0;
    return horas * 60 + minutos;
}

function horarioEstaNoIntervaloNoturno(inicio, fim) {
    const agora = new Date();
    const minutoAtual = agora.getHours() * 60 + agora.getMinutes();
    const minutoInicio = horaParaMinutos(inicio);
    const minutoFim = horaParaMinutos(fim);

    if (minutoInicio === minutoFim) return false;
    if (minutoInicio < minutoFim) return minutoAtual >= minutoInicio && minutoAtual < minutoFim;
    return minutoAtual >= minutoInicio || minutoAtual < minutoFim;
}

function manterOnboardingNoTemaEscuro() {
    document.documentElement.classList.add('dark-theme', 'guget-fixed-dark-page');
    document.body.classList.add('dark-theme', 'guget-fixed-dark-page');
}

function atualizarTemaOnboarding() {
    const modoTema = obterRadioSelecionado('onboarding-theme-mode', 'manual');

    const painelManual = qs('onboarding-theme-manual-panel');
    const painelHorario = qs('onboarding-theme-schedule-panel');

    if (painelManual) painelManual.hidden = modoTema !== 'manual';
    if (painelHorario) painelHorario.hidden = modoTema !== 'schedule';

    // A escolha do usuário continua sendo salva para a Dashboard,
    // mas a página de configuração inicial permanece sempre no visual noturno.
    manterOnboardingNoTemaEscuro();
}

function criarDadosFallback(user) {
    const nomeCompleto = user?.displayName || '';
    const partes = nomeCompleto.split(/\s+/).filter(Boolean);
    const nome = partes[0] || '';
    const sobrenome = partes.slice(1).join(' ');

    return {
        config: {
            perfil: {
                nome,
                sobrenome,
                username: '',
                email: user?.email || '',
                profissao: '',
                atualizadoEm: new Date().toISOString()
            },
            categorias: [...categoriasBase, "Terceiros", "Caixinha"],
            bancos: ["Cadastre seus cartões!"],
            detalhesBancos: [{ nome: "Cadastre seus cartões!", fechamento: 10, vencimento: 20 }],
            mostrarCaixinhaDashboard: false,
            onboardingConcluido: false,
            tutorialVisto: false
        },
        entradas: [],
        transacoes: [],
        metas: [],
        caixinha: []
    };
}

function garantirEstruturaDados() {
    if (!dadosUsuario) dadosUsuario = criarDadosFallback(usuarioAtual);
    if (!dadosUsuario.config) dadosUsuario.config = {};
    if (!dadosUsuario.config.perfil) dadosUsuario.config.perfil = {};
    if (!Array.isArray(dadosUsuario.config.categorias)) dadosUsuario.config.categorias = [];
    if (!Array.isArray(dadosUsuario.config.bancos)) dadosUsuario.config.bancos = [];
    if (!Array.isArray(dadosUsuario.config.detalhesBancos)) dadosUsuario.config.detalhesBancos = [];
    if (!Array.isArray(dadosUsuario.entradas)) dadosUsuario.entradas = [];
    if (!Array.isArray(dadosUsuario.transacoes)) dadosUsuario.transacoes = [];
    if (!Array.isArray(dadosUsuario.metas)) dadosUsuario.metas = [];
    if (!Array.isArray(dadosUsuario.caixinha)) dadosUsuario.caixinha = [];
}

function ehCartaoPlaceholder(cartao) {
    const nome = String(cartao?.nome || '').trim().toLowerCase();
    return !nome || nome === 'cadastre seus cartões!' || nome === 'cadastre seus cartoes!';
}

function obterCartoesValidos() {
    garantirEstruturaDados();
    return dadosUsuario.config.detalhesBancos.filter(cartao => !ehCartaoPlaceholder(cartao));
}

function atualizarListaCartoes() {
    const lista = qs('onboarding-card-list');
    if (!lista) return;

    const cartoes = obterCartoesValidos();
    if (!cartoes.length) {
        lista.innerHTML = '<span class="onboarding-empty">Nenhum cartão cadastrado ainda.</span>';
        return;
    }

    lista.innerHTML = cartoes.map((cartao, index) => `
        <span class="onboarding-pill">
            ${cartao.nome}
            ${cartao.isDebitoOnly ? '<small>Débito</small>' : `<small>F ${cartao.fechamento || '-'} / V ${cartao.vencimento || '-'}</small>`}
            <button type="button" onclick="removerCartaoOnboarding(${index})">×</button>
        </span>
    `).join('');
}

function adicionarCartaoOnboarding() {
    garantirEstruturaDados();

    const nome = (qs('onboarding-card-name')?.value || '').trim();
    const fechamento = parseInt(qs('onboarding-card-close')?.value || '0', 10);
    const vencimento = parseInt(qs('onboarding-card-due')?.value || '0', 10);
    const isDebitoOnly = qs('onboarding-card-debit')?.checked === true;
    const diaValido = (dia) => Number.isInteger(dia) && dia >= 1 && dia <= 31;

    if (!nome) {
        alert('Informe o nome do cartão ou conta.');
        return;
    }

    if (!isDebitoOnly && (!diaValido(fechamento) || !diaValido(vencimento))) {
        alert('Informe dias válidos de fechamento e vencimento para cartões de crédito.');
        return;
    }

    const cartoes = obterCartoesValidos();
    cartoes.push({
        nome,
        fechamento: isDebitoOnly ? '' : fechamento,
        vencimento: isDebitoOnly ? '' : vencimento,
        isDebitoOnly
    });

    dadosUsuario.config.detalhesBancos = cartoes;
    dadosUsuario.config.bancos = cartoes.map(cartao => cartao.nome);

    ['onboarding-card-name', 'onboarding-card-close', 'onboarding-card-due'].forEach(id => {
        const el = qs(id);
        if (el) el.value = '';
    });
    const debit = qs('onboarding-card-debit');
    if (debit) debit.checked = false;

    atualizarModoCartaoOnboarding();
    atualizarListaCartoes();
    atualizarBotoes();
}

function removerCartaoOnboarding(index) {
    const cartoes = obterCartoesValidos();
    cartoes.splice(index, 1);
    dadosUsuario.config.detalhesBancos = cartoes.length
        ? cartoes
        : [{ nome: "Cadastre seus cartões!", fechamento: 10, vencimento: 20 }];
    dadosUsuario.config.bancos = cartoes.length ? cartoes.map(cartao => cartao.nome) : ["Cadastre seus cartões!"];
    atualizarListaCartoes();
    atualizarBotoes();
}

function renderizarCategorias() {
    const grid = qs('onboarding-category-grid');
    if (!grid) return;

    const categorias = Array.from(new Set([...categoriasBase, ...categoriasSelecionadas]));
    grid.innerHTML = categorias.map(cat => `
        <button type="button" class="onboarding-chip ${categoriasSelecionadas.has(cat) ? 'active' : ''}" onclick="alternarCategoriaOnboarding('${cat.replace(/'/g, "\\'")}')">
            ${cat}
        </button>
    `).join('');
}

function alternarCategoriaOnboarding(categoria) {
    if (categoriasSelecionadas.has(categoria)) {
        categoriasSelecionadas.delete(categoria);
    } else {
        categoriasSelecionadas.add(categoria);
    }

    renderizarCategorias();
    atualizarBotoes();
}

function adicionarCategoriaOnboarding() {
    const input = qs('onboarding-category-custom');
    const valor = (input?.value || '').trim();
    if (!valor) return;

    categoriasSelecionadas.add(valor);
    if (input) input.value = '';
    renderizarCategorias();
    atualizarBotoes();
}

function aplicarTemaInicial() {
    // Onboarding é uma página institucional: sempre abre no visual noturno
    // para evitar o flash claro e manter a experiência consistente.
    manterOnboardingNoTemaEscuro();
}

function carregarCampos() {
    garantirEstruturaDados();
    aplicarTemaInicial();
    configurarSaidaDoOnboarding();
    configurarEventosCampos();

    const perfil = dadosUsuario.config.perfil || {};
    const nomeFirebase = (usuarioAtual?.displayName || '').split(/\s+/).filter(Boolean);

    qs('onboarding-first-name').value = perfil.nome || nomeFirebase[0] || '';
    qs('onboarding-last-name').value = perfil.sobrenome || nomeFirebase.slice(1).join(' ') || '';
    qs('onboarding-username').value = perfil.username ? `@${normalizarUsername(perfil.username)}` : '';
    qs('onboarding-profession').value = perfil.profissao || '';

    marcarRadio('onboarding-theme-mode', dadosUsuario.config.modoTema || 'manual');
    marcarRadio('onboarding-theme-manual', dadosUsuario.config.temaManual || dadosUsuario.config.tema || 'light');
    qs('onboarding-theme-start').value = dadosUsuario.config.temaTurnoInicio || '18:00';
    qs('onboarding-theme-end').value = dadosUsuario.config.temaTurnoFim || '06:00';
    atualizarTemaOnboarding();

    const existentes = (dadosUsuario.config.categorias || []).filter(Boolean);
    categoriasSelecionadas = new Set(existentes.length ? existentes : categoriasBase);

    atualizarListaCartoes();
    renderizarCategorias();
    atualizarModoCartaoOnboarding();
    verificarUsernameOnboarding();
    atualizarVisualEtapa();
}

function atualizarVisualEtapa() {
    document.querySelectorAll('[data-onboarding-step]').forEach((step, index) => {
        step.classList.toggle('active', index === etapaAtual);
    });

    document.querySelectorAll('#onboarding-steps-list li').forEach((item, index) => {
        item.classList.toggle('active', index <= etapaAtual);
    });

    const progresso = Math.round((etapaAtual / (totalEtapas - 1)) * 100);
    qs('onboarding-progress-label').textContent = `Etapa ${etapaAtual + 1} de ${totalEtapas}`;
    qs('onboarding-progress-percent').textContent = `${progresso}%`;
    qs('onboarding-progress-fill').style.width = `${progresso}%`;

    const back = qs('onboarding-back');
    if (back) back.style.visibility = etapaAtual === 0 ? 'hidden' : 'visible';

    const next = qs('onboarding-next');
    if (next) next.textContent = etapaAtual === totalEtapas - 1 ? 'Concluir e abrir a Dashboard' : 'Continuar';

    atualizarResumoFinal();
    atualizarBotoes();
}

function atualizarResumoFinal() {
    const el = qs('onboarding-done-summary');
    if (!el) return;

    const qtdCartoes = obterCartoesValidos().length;
    const qtdCategorias = categoriasSelecionadas.size;
    const textoCartoes = `${qtdCartoes} ${qtdCartoes === 1 ? 'cartão/conta' : 'cartões/contas'}`;
    const textoCategorias = `${qtdCategorias} ${qtdCategorias === 1 ? 'categoria' : 'categorias'}`;
    el.textContent = `${textoCartoes}, ${textoCategorias} e perfil preparados para começar.`;
}

function etapaValida() {
    if (etapaAtual === 1) return obterCartoesValidos().length > 0;
    if (etapaAtual === 2) return categoriasSelecionadas.size > 0;

    if (etapaAtual === 3) {
        const nome = (qs('onboarding-first-name')?.value || '').trim();
        const sobrenome = (qs('onboarding-last-name')?.value || '').trim();
        const username = normalizarUsername(qs('onboarding-username')?.value || '');
        const profissao = (qs('onboarding-profession')?.value || '').trim();
        return nome.length > 0 && sobrenome.length > 0 && username.length >= 3 && profissao.length > 0 && usernameDisponivel === true;
    }

    return true;
}

function atualizarBotoes() {
    const next = qs('onboarding-next');
    if (next) next.disabled = !etapaValida();
}

function voltarEtapaOnboarding() {
    if (etapaAtual <= 0) return;
    etapaAtual--;
    atualizarVisualEtapa();
}

async function avancarEtapaOnboarding() {
    if (!etapaValida()) return;

    if (etapaAtual < totalEtapas - 1) {
        etapaAtual++;
        atualizarVisualEtapa();
        return;
    }

    await concluirOnboarding();
}

function montarPerfilPublico(username, nomePublico, avatar = '') {
    return {
        uid: usuarioAtual.uid,
        nome: nomePublico || usuarioAtual.displayName || 'Usuário',
        username,
        usernameBusca: username,
        avatar: usuarioAtual.photoURL || avatar || '',
        atualizadoEm: new Date().toISOString()
    };
}

async function reservarUsername(username, usernameAnterior, perfilPublico) {
    const usernameLimpo = normalizarUsername(username);
    const anterior = normalizarUsername(usernameAnterior || '');
    if (!usernameLimpo) return;

    const novoRef = doc(db, 'usernames', usernameLimpo);
    const dadosIndice = {
        uid: usuarioAtual.uid,
        nome: perfilPublico.nome,
        username: usernameLimpo,
        usernameBusca: usernameLimpo,
        avatar: perfilPublico.avatar || '',
        atualizadoEm: serverTimestamp()
    };

    await runTransaction(db, async (transaction) => {
        const novoSnap = await transaction.get(novoRef);
        let antigoRef = null;
        let antigoSnap = null;

        if (anterior && anterior !== usernameLimpo) {
            antigoRef = doc(db, 'usernames', anterior);
            antigoSnap = await transaction.get(antigoRef);
        }

        if (novoSnap.exists() && novoSnap.data().uid !== usuarioAtual.uid) {
            throw new Error(`O @${usernameLimpo} já está em uso.`);
        }

        transaction.set(novoRef, dadosIndice, { merge: true });

        if (antigoRef && antigoSnap?.exists() && antigoSnap.data().uid === usuarioAtual.uid) {
            transaction.delete(antigoRef);
        }
    });
}

function aplicarPreferenciasNoObjeto() {
    garantirEstruturaDados();

    dadosUsuario.config.categorias = Array.from(categoriasSelecionadas);

    const perfil = dadosUsuario.config.perfil || {};
    const nome = (qs('onboarding-first-name')?.value || '').trim();
    const sobrenome = (qs('onboarding-last-name')?.value || '').trim();
    const username = normalizarUsername(qs('onboarding-username')?.value || '');
    const profissao = (qs('onboarding-profession')?.value || '').trim();

    dadosUsuario.config.perfil = {
        ...perfil,
        nome,
        sobrenome,
        username,
        email: usuarioAtual.email || perfil.email || '',
        profissao,
        atualizadoEm: new Date().toISOString()
    };

    const modoTema = obterRadioSelecionado('onboarding-theme-mode', 'manual');
    const temaManual = obterRadioSelecionado('onboarding-theme-manual', 'light');
    const turnoInicio = qs('onboarding-theme-start')?.value || '18:00';
    const turnoFim = qs('onboarding-theme-end')?.value || '06:00';

    dadosUsuario.config.modoTema = modoTema;
    dadosUsuario.config.temaManual = temaManual;
    dadosUsuario.config.tema = temaManual;
    dadosUsuario.config.temaTurnoInicio = turnoInicio;
    dadosUsuario.config.temaTurnoFim = turnoFim;
    dadosUsuario.config.onboardingConcluido = true;
    dadosUsuario.config.tutorialVisto = true;
}

async function concluirOnboarding() {
    const btn = qs('onboarding-next');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
    }

    try {
        const usernameAnterior = normalizarUsername(dadosUsuario?.config?.perfil?.username || '');
        aplicarPreferenciasNoObjeto();

        const perfil = dadosUsuario.config.perfil;
        const nomeCompleto = [perfil.nome, perfil.sobrenome].filter(Boolean).join(' ').trim();
        const perfilPublico = montarPerfilPublico(perfil.username, nomeCompleto, perfil.avatar || '');

        await reservarUsername(perfil.username, usernameAnterior, perfilPublico);

        if (nomeCompleto && usuarioAtual.displayName !== nomeCompleto) {
            await updateProfile(usuarioAtual, { displayName: nomeCompleto });
        }

        await setDoc(doc(db, 'usuarios', usuarioAtual.uid), {
            dados: dadosUsuario,
            perfilPublico
        }, { merge: true });

        localStorage.setItem('salsifin_cache', JSON.stringify(dadosUsuario));
        localStorage.setItem('guget_tema_preferido', dadosUsuario.config.tema || 'light');
        if (window.gugetNavigateWithLoader) { window.gugetNavigateWithLoader('index.html', 'Carregando sua conta...'); } else { window.location.href = 'index.html'; }
    } catch (error) {
        console.error('Erro ao concluir onboarding:', error);
        alert('Erro ao concluir a configuração: ' + error.message);
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Concluir e abrir a Dashboard';
        }
    }
}

async function carregarDadosUsuario(user) {
    usuarioAtual = user;
    setStatus('Preparando configuração...');

    const ref = doc(db, 'usuarios', user.uid);
    const snap = await getDoc(ref);
    dadosUsuario = snap.exists() && snap.data().dados
        ? snap.data().dados
        : criarDadosFallback(user);

    garantirEstruturaDados();

    if (dadosUsuario.config.onboardingConcluido === true && !modoRevisao) {
        if (window.gugetNavigateWithLoader) { window.gugetNavigateWithLoader('index.html', 'Carregando sua conta...'); } else { window.location.href = 'index.html'; }
        return;
    }

    carregarCampos();
    setStatus('Configuração em andamento');
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        if (window.gugetNavigateWithLoader) { window.gugetNavigateWithLoader('index.html', 'Carregando sua conta...'); } else { window.location.href = 'index.html'; }
        return;
    }

    try {
        await carregarDadosUsuario(user);
    } catch (error) {
        console.error('Erro ao carregar onboarding:', error);
        setStatus('Erro ao carregar configuração.');
        alert('Não foi possível carregar a configuração inicial. Tente novamente.');
    }
});

window.adicionarCartaoOnboarding = adicionarCartaoOnboarding;
window.removerCartaoOnboarding = removerCartaoOnboarding;
window.alternarCategoriaOnboarding = alternarCategoriaOnboarding;
window.adicionarCategoriaOnboarding = adicionarCategoriaOnboarding;
window.voltarEtapaOnboarding = voltarEtapaOnboarding;
window.avancarEtapaOnboarding = avancarEtapaOnboarding;
window.normalizarCampoUsernameOnboarding = normalizarCampoUsernameOnboarding;
window.atualizarModoCartaoOnboarding = atualizarModoCartaoOnboarding;
window.atualizarTemaOnboarding = atualizarTemaOnboarding;
