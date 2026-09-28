(() => {
    const card = document.getElementById('mobile-install-app');
    const button = document.getElementById('btn-mobile-install-app');
    const help = document.getElementById('mobile-install-app-help');
    if (!card || !button || !help) return;

    const userAgent = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);
    const isMobile = isIOS || isAndroid || window.matchMedia('(max-width: 1024px) and (pointer: coarse)').matches;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || navigator.standalone === true;
    let installPrompt = null;

    if (!isMobile || isStandalone) return;

    const showCard = () => {
        card.hidden = false;
    };

    const showInstructions = () => {
        help.innerHTML = isIOS
            ? 'No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.'
            : 'No Chrome, abra o menu <strong>⋮</strong> e toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.';
        help.hidden = false;
        button.textContent = 'Ver instruções';
    };

    showCard();

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
        help.hidden = true;
        button.textContent = 'Instalar';
        showCard();
    });

    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        card.hidden = true;
    });

    button.addEventListener('click', async () => {
        if (!installPrompt) {
            showInstructions();
            return;
        }

        installPrompt.prompt();
        const result = await installPrompt.userChoice;
        installPrompt = null;
        if (result.outcome === 'accepted') card.hidden = true;
        else showInstructions();
    });
})();
