/* ========================================================= */
/* API E INTEGRACOES EXTERNAS                               */
/* ========================================================= */

const GUGETFIN_API_BASE_URL = window.GUGETFIN_API_BASE_URL
    || 'https://southamerica-east1-guget-fin.cloudfunctions.net/api/v1';

let gugetApiCarregando = false;
let conviteWhatsAppUsuario = '';

function escaparHtmlIntegracao(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatarDataIntegracao(valor) {
    if (!valor) return 'Ainda não utilizado';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return 'Data indisponível';
    return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

async function obterTokenFirebaseApiGugetFin() {
    const usuario = window.auth?.currentUser;
    if (!usuario) throw new Error('Entre novamente na sua conta para gerenciar integrações.');
    return usuario.getIdToken(true);
}

async function requisicaoApiGugetFin(caminho, opcoes = {}) {
    const token = await obterTokenFirebaseApiGugetFin();
    const resposta = await fetch(`${GUGETFIN_API_BASE_URL}${caminho}`, {
        ...opcoes,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(opcoes.headers || {})
        }
    });
    const payload = await resposta.json().catch(() => ({}));
    if (!resposta.ok || payload.success === false) {
        const erro = new Error(payload?.error?.message || 'Não foi possível acessar a API do GugetFin.');
        erro.code = payload?.error?.code || 'api_error';
        erro.status = resposta.status;
        throw erro;
    }
    return payload.data;
}

function guardarPausaConviteWhatsApp(uid, dias) {
    if (!uid) return;
    const ate = Date.now() + (dias * 24 * 60 * 60 * 1000);
    localStorage.setItem(`gugetfin_whatsapp_invite_${uid}`, String(ate));
}

function fecharConviteWhatsApp(uid, dias = 14) {
    guardarPausaConviteWhatsApp(uid, dias);
    const modal = document.getElementById('modal-whatsapp-invite');
    if (modal?.open) modal.close();
}

async function iniciarConviteWhatsAppGugetFin(usuario = window.auth?.currentUser) {
    if (!usuario?.uid || conviteWhatsAppUsuario === usuario.uid) return;
    conviteWhatsAppUsuario = usuario.uid;

    const modal = document.getElementById('modal-whatsapp-invite');
    const conectar = document.getElementById('btn-connect-whatsapp-invite');
    const ignorar = document.getElementById('btn-skip-whatsapp-invite');
    const fechar = document.getElementById('btn-close-whatsapp-invite');
    if (!modal || !conectar || !ignorar || !fechar) return;

    const pausaAte = Number(localStorage.getItem(`gugetfin_whatsapp_invite_${usuario.uid}`) || 0);
    if (pausaAte > Date.now()) return;

    try {
        const status = await requisicaoApiGugetFin('/whatsapp/status');
        if (status?.connected) {
            localStorage.removeItem(`gugetfin_whatsapp_invite_${usuario.uid}`);
            return;
        }
    } catch (error) {
        console.warn('Não foi possível verificar a conexão do WhatsApp:', error);
        conviteWhatsAppUsuario = '';
        return;
    }

    ignorar.onclick = () => fecharConviteWhatsApp(usuario.uid, 14);
    fechar.onclick = () => fecharConviteWhatsApp(usuario.uid, 14);
    conectar.onclick = () => {
        guardarPausaConviteWhatsApp(usuario.uid, 1);
        if (modal.open) modal.close();
    };
    modal.addEventListener('cancel', event => {
        event.preventDefault();
        fecharConviteWhatsApp(usuario.uid, 14);
    }, { once: true });

    let tentativas = 0;
    const exibirQuandoLivre = () => {
        tentativas += 1;
        const outroModalAberto = Array.from(document.querySelectorAll('dialog[open]'))
            .some(dialog => dialog !== modal);
        const menuAberto = document.getElementById('menu-dropdown')?.classList.contains('active');

        if ((outroModalAberto || menuAberto) && tentativas < 12) {
            window.setTimeout(exibirQuandoLivre, 1000);
            return;
        }
        if (!outroModalAberto && !menuAberto && !modal.open) modal.showModal();
    };

    window.setTimeout(exibirQuandoLivre, 900);
}

function atualizarStatusApiGugetFin(status, texto) {
    const badge = document.getElementById('settings-api-status');
    if (!badge) return;
    badge.textContent = texto;
    badge.classList.toggle('is-safe', status === 'online');
    badge.classList.toggle('is-warning', status === 'offline');
}

async function testarApiGugetFin() {
    atualizarStatusApiGugetFin('loading', 'Testando...');
    try {
        const resposta = await fetch(`${GUGETFIN_API_BASE_URL}/health`, { cache: 'no-store' });
        const payload = await resposta.json();
        if (!resposta.ok || payload.success !== true) throw new Error('API indisponível');
        atualizarStatusApiGugetFin('online', 'Online');
        if (typeof mostrarToast === 'function') mostrarToast('API GugetFin conectada.');
    } catch (error) {
        atualizarStatusApiGugetFin('offline', 'Não publicada');
        if (typeof mostrarToast === 'function') mostrarToast('A API ainda precisa ser publicada no Firebase.');
    }
}

function renderizarChavesApiGugetFin(chaves, whatsapp = { connected: false }) {
    const lista = document.getElementById('settings-api-key-list');
    const contador = document.getElementById('settings-api-key-count');
    if (!lista || !contador) return;

    const total = chaves.length + (whatsapp.connected ? 1 : 0);
    contador.textContent = String(total);
    if (!total) {
        lista.innerHTML = `
            <div class="settings-api-empty">
                <i class="fi fi-rr-link-alt"></i>
                <strong>Nenhuma integração conectada</strong>
                <span>Crie uma chave ou conecte seu WhatsApp para começar.</span>
            </div>
        `;
        return;
    }

    const itens = chaves.map(chave => `
        <article class="settings-api-key-item">
            <div class="settings-api-key-icon"><i class="fi fi-rr-device-mobile"></i></div>
            <div class="settings-api-key-copy">
                <strong>${escaparHtmlIntegracao(chave.name)}</strong>
                <code>${escaparHtmlIntegracao(chave.prefix)}</code>
                <span>Criada em ${formatarDataIntegracao(chave.createdAt)} · Último uso: ${formatarDataIntegracao(chave.lastUsedAt)}</span>
            </div>
            <button type="button" class="btn-settings-ghost settings-api-revoke" onclick="revogarChaveApiGugetFin('${escaparHtmlIntegracao(chave.id)}')">Revogar</button>
        </article>
    `);

    if (whatsapp.connected) {
        itens.unshift(`
            <article class="settings-api-key-item settings-integration-whatsapp">
                <div class="settings-api-key-icon"><i class="fi fi-rr-comment-alt"></i></div>
                <div class="settings-api-key-copy">
                    <strong>WhatsApp GugetFin</strong>
                    <code>${escaparHtmlIntegracao(whatsapp.phone || 'Número vinculado')}</code>
                    <span>Conectado em ${formatarDataIntegracao(whatsapp.linkedAt)} · Pode consultar opções e cadastrar lançamentos</span>
                </div>
                <button type="button" class="btn-settings-ghost settings-api-revoke" onclick="revogarWhatsAppGugetFin()">Desconectar</button>
            </article>
        `);
    }

    lista.innerHTML = itens.join('');
}

async function carregarIntegracoesApiGugetFin() {
    const url = document.getElementById('settings-api-url');
    const lista = document.getElementById('settings-api-key-list');
    if (url) url.textContent = GUGETFIN_API_BASE_URL;
    if (!lista || gugetApiCarregando) return;

    gugetApiCarregando = true;
    lista.innerHTML = '<div class="settings-session-empty">Carregando integrações...</div>';
    try {
        const [chaves, whatsapp] = await Promise.all([
            requisicaoApiGugetFin('/integrations/keys'),
            requisicaoApiGugetFin('/whatsapp/status')
        ]);
        renderizarChavesApiGugetFin(Array.isArray(chaves) ? chaves : [], whatsapp || { connected: false });
        atualizarStatusApiGugetFin('online', 'Online');
    } catch (error) {
        const mensagem = error.status === 404 || error.status >= 500 || error.name === 'TypeError'
            ? 'A API ainda não foi publicada ou está indisponível.'
            : error.message;
        lista.innerHTML = `<div class="settings-api-error">${escaparHtmlIntegracao(mensagem)}</div>`;
        atualizarStatusApiGugetFin('offline', 'Não publicada');
    } finally {
        gugetApiCarregando = false;
    }
}

async function criarChaveApiGugetFin() {
    const input = document.getElementById('settings-api-key-name');
    const botao = document.getElementById('btn-create-api-key');
    const nome = input?.value.trim() || '';
    if (nome.length < 2) {
        if (typeof mostrarToast === 'function') mostrarToast('Dê um nome para o dispositivo.');
        input?.focus();
        return;
    }

    if (botao) {
        botao.disabled = true;
        botao.textContent = 'Criando chave...';
    }
    try {
        const chave = await requisicaoApiGugetFin('/integrations/keys', {
            method: 'POST',
            body: JSON.stringify({ name: nome })
        });
        if (input) input.value = '';
        const segredo = document.getElementById('api-key-secret-value');
        const modal = document.getElementById('modal-api-key');
        if (segredo) segredo.textContent = chave.token;
        if (modal?.showModal) modal.showModal();
        await carregarIntegracoesApiGugetFin();
    } catch (error) {
        if (typeof mostrarToast === 'function') mostrarToast(error.message);
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent = 'Criar chave';
        }
    }
}

async function revogarChaveApiGugetFin(id) {
    const confirmou = confirm('Revogar esta integração? O dispositivo deixará de acessar sua conta imediatamente.');
    if (!confirmou) return;
    try {
        await requisicaoApiGugetFin(`/integrations/keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (typeof mostrarToast === 'function') mostrarToast('Integração revogada.');
        await carregarIntegracoesApiGugetFin();
    } catch (error) {
        if (typeof mostrarToast === 'function') mostrarToast(error.message);
    }
}

async function revogarWhatsAppGugetFin() {
    const confirmou = confirm('Desconectar o WhatsApp? Esse número deixará de consultar e cadastrar lançamentos imediatamente. Seus dados já cadastrados não serão apagados.');
    if (!confirmou) return;
    try {
        await requisicaoApiGugetFin('/whatsapp/connection', { method: 'DELETE' });
        const usuario = window.auth?.currentUser;
        if (usuario?.uid) localStorage.removeItem(`gugetfin_whatsapp_invite_${usuario.uid}`);
        if (typeof mostrarToast === 'function') mostrarToast('WhatsApp desconectado do GugetFin.');
        await carregarIntegracoesApiGugetFin();
    } catch (error) {
        if (typeof mostrarToast === 'function') mostrarToast(error.message);
    }
}

async function copiarChaveApiGugetFin() {
    const valor = document.getElementById('api-key-secret-value')?.textContent || '';
    if (!valor) return;
    try {
        await navigator.clipboard.writeText(valor);
        if (typeof mostrarToast === 'function') mostrarToast('Chave copiada.');
    } catch (error) {
        if (typeof mostrarToast === 'function') mostrarToast('Selecione e copie a chave manualmente.');
    }
}

function fecharModalChaveApi() {
    const modal = document.getElementById('modal-api-key');
    const segredo = document.getElementById('api-key-secret-value');
    if (segredo) segredo.textContent = '';
    if (modal?.open) modal.close();
}

document.addEventListener('DOMContentLoaded', () => {
    const url = document.getElementById('settings-api-url');
    if (url) url.textContent = GUGETFIN_API_BASE_URL;
});

window.iniciarConviteWhatsAppGugetFin = iniciarConviteWhatsAppGugetFin;
