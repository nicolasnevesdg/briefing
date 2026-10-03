importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyD1HyxzZ-YFMMbMSIwBDDKfNWdCWHb07AY',
    authDomain: 'guget-fin.firebaseapp.com',
    projectId: 'guget-fin',
    storageBucket: 'guget-fin.firebasestorage.app',
    messagingSenderId: '626285959649',
    appId: '1:626285959649:web:9b1006694a4d05fa899aa0'
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
    const notification = payload?.notification || {};
    const data = payload?.data || {};
    const title = notification.title || data.title || 'GugetFin';
    const options = {
        body: notification.body || data.body || 'Você tem uma nova atualização.',
        icon: './assets/icon-192.png',
        badge: './assets/icon-192.png',
        data: { url: data.url || './index.html' }
    };
    self.registration.showNotification(title, options);
});

const CACHE_NAME = 'gugetfin-shell-20261003-5';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './assets/icon-192.png',
    './assets/icon-512.png',
    './assets/logo-positive.svg',
    './assets/logo-negative.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith('gugetfin-shell-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    return response;
                })
                .catch(async () => (await caches.match(request)) || caches.match('./index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cached => {
            const network = fetch(request).then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                }
                return response;
            });
            return cached || network;
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const destination = event.notification?.data?.url || './index.html';
    event.waitUntil(clients.openWindow(destination));
});
