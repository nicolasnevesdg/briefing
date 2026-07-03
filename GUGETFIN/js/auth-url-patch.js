/* auth-url-patch.js
   Coloque este arquivo depois do js/auth.js no index.html:
   <script src="js/auth-url-patch.js"></script>

   Ele faz a landing abrir direto em login ou cadastro usando:
   index.html?auth=login
   index.html?auth=register
*/
(function () {
  function getAuthIntent() {
    const params = new URLSearchParams(window.location.search);
    const auth = (params.get('auth') || '').toLowerCase();
    const mode = (params.get('mode') || '').toLowerCase();

    let intent = '';
    if (auth === 'register' || auth === 'cadastro' || mode === 'signup' || mode === 'register') intent = 'register';
    if (auth === 'login' || auth === 'entrar') intent = 'login';

    try {
      intent = intent || sessionStorage.getItem('gugetfin_auth_intent') || '';
      sessionStorage.removeItem('gugetfin_auth_intent');
    } catch (_) {}

    return intent;
  }

  const intent = getAuthIntent();
  if (!intent) return;

  function aplicarIntent() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authScreen = document.getElementById('auth-screen');

    if (!loginForm || !registerForm || typeof window.toggleAuth !== 'function') return false;

    if (authScreen) authScreen.style.display = 'flex';

    const authLeft = document.querySelector('.auth-left');
    const authRight = document.getElementById('auth-showcase');

    if (window.innerWidth <= 1024) {
      if (authLeft) authLeft.style.display = 'flex';
      if (authRight) authRight.style.display = 'none';
    }

    window.toggleAuth(intent === 'register');

    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
    return true;
  }

  let tentativas = 0;
  const intervalo = window.setInterval(() => {
    tentativas += 1;
    if (aplicarIntent() || tentativas > 40) {
      window.clearInterval(intervalo);
    }
  }, 100);

  window.addEventListener('load', () => {
    setTimeout(aplicarIntent, 300);
    setTimeout(aplicarIntent, 900);
  });
})();
