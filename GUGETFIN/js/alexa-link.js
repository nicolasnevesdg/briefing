import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
    browserLocalPersistence,
    getAuth,
    onAuthStateChanged,
    setPersistence,
    signInWithEmailAndPassword,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const API_URL = 'https://southamerica-east1-guget-fin.cloudfunctions.net/api/v1';
const CLIENT_ID = 'gugetfin-alexa';
const REDIRECT_HOSTS = new Set(['pitangui.amazon.com', 'layla.amazon.com', 'alexa.amazon.co.jp']);
const firebaseConfig = {
    apiKey: 'AIzaSyD1HyxzZ-YFMMbMSIwBDDKfNWdCWHb07AY',
    authDomain: 'guget-fin.firebaseapp.com',
    projectId: 'guget-fin',
    storageBucket: 'guget-fin.firebasestorage.app',
    messagingSenderId: '626285959649',
    appId: '1:626285959649:web:9b1006694a4d05fa899aa0'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'pt-BR';

const params = new URLSearchParams(window.location.search);
const oauth = {
    client_id: params.get('client_id') || '',
    redirect_uri: params.get('redirect_uri') || '',
    response_type: params.get('response_type') || '',
    state: params.get('state') || '',
    scope: params.get('scope') || '',
    code_challenge: params.get('code_challenge') || '',
    code_challenge_method: params.get('code_challenge_method') || ''
};

const loginForm = document.getElementById('alexa-login-form');
const session = document.getElementById('alexa-session');
const sessionEmail = document.getElementById('alexa-session-email');
const loginButton = document.getElementById('alexa-login-button');
const authorizeButton = document.getElementById('alexa-authorize-button');
const changeAccountButton = document.getElementById('alexa-change-account');
const cancelButton = document.getElementById('alexa-cancel-button');
const status = document.getElementById('alexa-status');
const content = document.getElementById('alexa-content');
const invalid = document.getElementById('alexa-invalid');

function redirectValido(valor) {
    try {
        const url = new URL(valor);
        return url.protocol === 'https:'
            && REDIRECT_HOSTS.has(url.hostname)
            && /^\/api\/skill\/link\/[A-Za-z0-9]+\/?$/.test(url.pathname);
    } catch (error) {
        return false;
    }
}

function pedidoValido() {
    return oauth.client_id === CLIENT_ID
        && oauth.response_type === 'code'
        && Boolean(oauth.state)
        && redirectValido(oauth.redirect_uri);
}

function mostrarStatus(mensagem, tipo = '') {
    status.textContent = mensagem || '';
    status.className = `alexa-status${tipo ? ` is-${tipo}` : ''}`;
}

function erroLogin(error) {
    const code = String(error?.code || '');
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        return 'E-mail ou senha incorretos.';
    }
    if (code.includes('too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    if (code.includes('network-request-failed')) return 'Não foi possível conectar. Confira sua internet.';
    return 'Não foi possível entrar na sua conta.';
}

async function autorizar() {
    const user = auth.currentUser;
    if (!user || !pedidoValido()) return;
    authorizeButton.disabled = true;
    changeAccountButton.disabled = true;
    mostrarStatus('Conectando sua conta à Alexa...');
    try {
        const token = await user.getIdToken(true);
        const response = await fetch(`${API_URL}/oauth/authorize`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(oauth)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.data?.redirectUri) {
            throw new Error(payload?.error?.message || 'Não foi possível autorizar a conexão.');
        }
        mostrarStatus('Conta autorizada. Voltando para a Alexa...', 'success');
        window.location.replace(payload.data.redirectUri);
    } catch (error) {
        mostrarStatus(error.message || 'Não foi possível autorizar a conexão.', 'error');
        authorizeButton.disabled = false;
        changeAccountButton.disabled = false;
    }
}

function cancelar() {
    if (!redirectValido(oauth.redirect_uri)) {
        window.location.replace('./landing.html');
        return;
    }
    const retorno = new URL(oauth.redirect_uri);
    retorno.searchParams.set('error', 'access_denied');
    retorno.searchParams.set('state', oauth.state);
    window.location.replace(retorno.toString());
}

if (!pedidoValido()) {
    invalid.hidden = false;
    content.hidden = true;
} else {
    setPersistence(auth, browserLocalPersistence).catch(() => null);
    onAuthStateChanged(auth, user => {
        loginForm.hidden = Boolean(user);
        session.hidden = !user;
        sessionEmail.textContent = user?.email || user?.displayName || '';
        mostrarStatus('');
    });

    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        const email = document.getElementById('alexa-email').value.trim().toLowerCase();
        const password = document.getElementById('alexa-password').value;
        if (!email || !password) {
            mostrarStatus('Preencha o e-mail e a senha.', 'error');
            return;
        }
        loginButton.disabled = true;
        mostrarStatus('Entrando na sua conta...');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            mostrarStatus(erroLogin(error), 'error');
        } finally {
            loginButton.disabled = false;
        }
    });

    authorizeButton.addEventListener('click', autorizar);
    changeAccountButton.addEventListener('click', async () => {
        await signOut(auth);
        document.getElementById('alexa-password').value = '';
        document.getElementById('alexa-email').focus();
    });
    cancelButton.addEventListener('click', cancelar);
}
