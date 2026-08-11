/* ========================================================= */
/* CONTROLE GLOBAL DE ROLAGEM DOS DIALOGS                    */
/* ========================================================= */

(function configurarRolagemGlobalDosModais() {
    let bloqueioAtivo = false;
    let rolagemAnterior = 0;
    let estilosAnteriores = null;

    function obterDialogAtivo() {
        const abertos = document.querySelectorAll('dialog[open]');
        return abertos.length ? abertos[abertos.length - 1] : null;
    }

    function bloquearFundo() {
        if (bloqueioAtivo) return;
        bloqueioAtivo = true;
        rolagemAnterior = window.scrollY || document.documentElement.scrollTop || 0;
        estilosAnteriores = {
            position: document.body.style.position,
            top: document.body.style.top,
            right: document.body.style.right,
            left: document.body.style.left,
            width: document.body.style.width,
            overflow: document.body.style.overflow
        };

        document.body.classList.add('modal-scroll-locked');
        if (window.matchMedia('(max-width: 1024px)').matches) {
            document.body.style.top = `-${rolagemAnterior}px`;
        }
    }

    function liberarFundo() {
        if (!bloqueioAtivo) return;
        bloqueioAtivo = false;
        document.body.classList.remove('modal-scroll-locked');

        if (estilosAnteriores) {
            Object.entries(estilosAnteriores).forEach(([propriedade, valor]) => {
                document.body.style[propriedade] = valor;
            });
        }

        const restaurarEm = rolagemAnterior;
        estilosAnteriores = null;
        requestAnimationFrame(() => window.scrollTo(0, restaurarEm));
    }

    function sincronizarBloqueioDosModais() {
        if (obterDialogAtivo()) bloquearFundo();
        else liberarFundo();
    }

    function impedirRolagemForaDoModal(evento) {
        const dialogAtivo = obterDialogAtivo();
        if (!dialogAtivo) return;
        if (!dialogAtivo.contains(evento.target)) evento.preventDefault();
    }

    const observador = new MutationObserver(sincronizarBloqueioDosModais);
    observador.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['open']
    });

    document.addEventListener('toggle', sincronizarBloqueioDosModais, true);
    document.addEventListener('close', sincronizarBloqueioDosModais, true);
    document.addEventListener('cancel', () => requestAnimationFrame(sincronizarBloqueioDosModais), true);
    document.addEventListener('wheel', impedirRolagemForaDoModal, { capture: true, passive: false });
    document.addEventListener('touchmove', impedirRolagemForaDoModal, { capture: true, passive: false });

    sincronizarBloqueioDosModais();
})();
