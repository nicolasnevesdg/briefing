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

const token = new URLSearchParams(window.location.search).get('token') || '';
const loginForm = document.getElementById('whatsapp-login-form');
const session = document.getElementById('whatsapp-session');
const sessionEmail = document.getElementById('whatsapp-session-email');
const loginButton = document.getElementById('whatsapp-login-button');
const authorizeButton = document.getElementById('whatsapp-authorize-button');
const changeAccountButton = document.getElementById('whatsapp-change-account');
const cancelButton = document.getElementById('whatsapp-cancel-button');
const status = document.getElementById('whatsapp-status');
const content = document.getElementById('alexa-content');
const invalid = document.getElementById('whatsapp-invalid');

function mostrarStatus(mensagem, tipo = '') {
    status.textContent = mensagem || '';
    status.className = `alexa-status${tipo ? ` is-${tipo}` : ''}`;
}

function erroLogin(error) {
    const code = String(error?.code || '');
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'E-mail ou senha incorretos.';
    if (code.includes('too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    if (code.includes('network-request-failed')) return 'Não foi possível conectar. Confira sua internet.';
    return 'Não foi possível entrar na sua conta.';
}

async function autorizar() {
    const user = auth.currentUser;
    if (!user || token.length < 32) return;
    authorizeButton.disabled = true;
    changeAccountButton.disabled = true;
    mostrarStatus('Conectando sua conta ao WhatsApp...');
    try {
        const idToken = await user.getIdToken(true);
        const response = await fetch(`${API_URL}/whatsapp/link`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.data?.linked !== true) throw new Error(payload?.error?.message || 'Não foi possível conectar.');
        mostrarStatus('WhatsApp conectado! Volte à conversa e envie “oi” para começar.', 'success');
        authorizeButton.hidden = true;
        changeAccountButton.hidden = true;
        cancelButton.textContent = 'Ir para o GugetFin';
    } catch (error) {
        mostrarStatus(error.message || 'Não foi possível conectar.', 'error');
        authorizeButton.disabled = false;
        changeAccountButton.disabled = false;
    }
}

if (token.length < 32) {
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
        const email = document.getElementById('whatsapp-email').value.trim().toLowerCase();
        const password = document.getElementById('whatsapp-password').value;
        if (!email || !password) return mostrarStatus('Preencha o e-mail e a senha.', 'error');
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
        document.getElementById('whatsapp-password').value = '';
        document.getElementById('whatsapp-email').focus();
    });
    cancelButton.addEventListener('click', () => window.location.replace('./index.html'));
}
