// 1. Importa as bibliotecas do Firebase para segundo plano
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 2. O seu passaporte do Firebase (conforme me enviou)
const firebaseConfig = {
    apiKey: "AIzaSyD1HyxzZ-YFMMbMSIwBDDKfNWdCWHb07AY",
    authDomain: "guget-fin.firebaseapp.com",
    projectId: "guget-fin",
    storageBucket: "guget-fin.firebasestorage.app",
    messagingSenderId: "626285959649",
    appId: "1:626285959649:web:9b1006694a4d05fa899aa0"
};

// 3. Inicializa o Firebase no Service Worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 4. Configura o que acontece quando a mensagem chega às 20h (App fechado)
messaging.onBackgroundMessage((payload) => {
    console.log('Notificação recebida:', payload);
    
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon.png', // Verifique se tem um ícone nesta pasta
        badge: '/icon.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- Mantém o que você já tinha (Instalação e Fetch) ---
self.addEventListener('install', (e) => {
    console.log('Service Worker instalado com Suporte Push!');
});

self.addEventListener('fetch', (e) => {
    e.respondWith(fetch(e.request));
});
