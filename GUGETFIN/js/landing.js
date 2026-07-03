/* landing.js — GugetFin */
(() => {
  const APP_URL = './index.html';
  const LOGIN_URL = './index.html?auth=login';
  const REGISTER_URL = './index.html?auth=register';

  function esconderLoading() {
    const loading = document.getElementById('landing-loading');
    if (!loading) return;
    window.setTimeout(() => loading.classList.add('is-hidden'), 250);
  }

  window.addEventListener('load', esconderLoading);
  window.setTimeout(esconderLoading, 1400);

  const header = document.querySelector('.landing-header');
  const menuBtn = document.getElementById('landing-menu-btn');
  const nav = document.getElementById('landing-nav');

  function atualizarHeader() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 18);
  }

  atualizarHeader();
  window.addEventListener('scroll', atualizarHeader, { passive: true });

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      document.body.classList.toggle('landing-menu-open');
      menuBtn.setAttribute('aria-expanded', document.body.classList.contains('landing-menu-open') ? 'true' : 'false');
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        document.body.classList.remove('landing-menu-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.addEventListener('click', (event) => {
    const authLink = event.target.closest('[data-auth-link]');
    if (!authLink) return;

    const mode = authLink.dataset.authLink;
    try {
      sessionStorage.setItem('gugetfin_auth_intent', mode === 'register' ? 'register' : 'login');
    } catch (_) {}
  });

  function atualizarLinksAutenticados(user) {
    const actions = document.getElementById('landing-actions');

    if (user && actions) {
      actions.classList.add('is-authenticated');
      actions.innerHTML = `<a class="btn btn-primary" href="${APP_URL}">Acessar App</a>`;
    }

    if (user) {
      document.querySelectorAll('[data-auth-link]').forEach((link) => {
        link.href = APP_URL;
        link.dataset.authLink = 'app';
        if (/começar|criar/i.test(link.textContent || '')) {
          link.textContent = 'Acessar minha conta';
        }
      });
    } else {
      document.querySelectorAll('[data-auth-link="login"]').forEach((link) => { link.href = LOGIN_URL; });
      document.querySelectorAll('[data-auth-link="register"]').forEach((link) => { link.href = REGISTER_URL; });
    }
  }

  // Detecta login ativo para trocar Login/Começar agora por Acessar App.
  // Se o Firebase não carregar por qualquer motivo, a landing continua funcionando com os links normais.
  import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js')
    .then(({ initializeApp }) => Promise.all([
      Promise.resolve(initializeApp({
        apiKey: 'AIzaSyD1HyxzZ-YFMMbMSIwBDDKfNWdCWHb07AY',
        authDomain: 'guget-fin.firebaseapp.com',
        projectId: 'guget-fin',
        storageBucket: 'guget-fin.firebasestorage.app',
        messagingSenderId: '626285959649',
        appId: '1:626285959649:web:9b1006694a4d05fa899aa0'
      })),
      import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js')
    ]))
    .then(([app, authMod]) => {
      const auth = authMod.getAuth(app);
      authMod.onAuthStateChanged(auth, atualizarLinksAutenticados);
    })
    .catch(() => atualizarLinksAutenticados(null));

  // Reveal suave
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach((item) => observer.observe(item));
  } else {
    reveals.forEach((item) => item.classList.add('is-visible'));
  }

  // Tabs do produto
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPreviews = document.querySelectorAll('.tab-preview');
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;
      tabButtons.forEach((btn) => btn.classList.remove('active'));
      tabPreviews.forEach((preview) => preview.classList.remove('active'));
      button.classList.add('active');
      const preview = document.getElementById(`tab-${target}`);
      if (preview) preview.classList.add('active');
    });
  });

  // Depoimentos automáticos
  const cards = document.querySelectorAll('.testimonial-card');
  const dots = document.querySelectorAll('.slider-dots span');
  let testimonialIndex = 0;

  function mostrarDepoimento(index) {
    if (!cards.length) return;
    testimonialIndex = index % cards.length;
    cards.forEach((card, i) => card.classList.toggle('active', i === testimonialIndex));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === testimonialIndex));
  }

  if (cards.length > 1) {
    setInterval(() => mostrarDepoimento(testimonialIndex + 1), 4500);
  }
})();
