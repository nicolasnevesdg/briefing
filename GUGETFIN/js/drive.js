(function () {
    const DRIVE_PREFIX = 'drive://';
    const DRIVE_API_ORIGIN = 'https://southamerica-east1-guget-fin.cloudfunctions.net';
    let accessToken = '';
    let tokenExpiresAt = 0;
    let statusCarregadoEm = 0;
    let carregandoStatus = null;

    function configDrive() {
        if (!salsiData.config) salsiData.config = {};
        if (!salsiData.config.googleDrive) {
            salsiData.config.googleDrive = { conectado: false, pastaId: '', email: '' };
        }
        return salsiData.config.googleDrive;
    }

    function persistirDrive() {
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
    }

    async function requisicaoDriveGugetFin(caminho, opcoes = {}) {
        if (typeof requisicaoApiGugetFin === 'function') {
            return requisicaoApiGugetFin(caminho, opcoes);
        }
        const usuario = window.auth?.currentUser;
        if (!usuario) throw new Error('Entre novamente para acessar o Google Drive.');
        const token = await usuario.getIdToken(true);
        const resposta = await fetch(`https://southamerica-east1-guget-fin.cloudfunctions.net/api/v1${caminho}`, {
            ...opcoes,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...(opcoes.headers || {})
            }
        });
        const payload = await resposta.json().catch(() => ({}));
        if (!resposta.ok || payload.success === false) {
            throw new Error(payload?.error?.message || 'Não foi possível acessar a integração com o Drive.');
        }
        return payload.data;
    }

    async function carregarStatusDrive(forcar = false) {
        if (!window.auth?.currentUser) return { connected: false };
        if (!forcar && Date.now() - statusCarregadoEm < 30000) {
            const config = configDrive();
            return { connected: config.conectado, email: config.email || '' };
        }
        if (carregandoStatus) return carregandoStatus;
        carregandoStatus = requisicaoDriveGugetFin('/drive/status')
            .then(status => {
                statusCarregadoEm = Date.now();
                const config = configDrive();
                const conectado = status?.connected === true;
                const email = conectado ? String(status.email || '') : '';
                const mudou = config.conectado !== conectado || config.email !== email;
                config.conectado = conectado;
                config.email = email;
                if (!conectado) config.pastaId = '';
                if (mudou) persistirDrive();
                renderizarStatusDrive();
                return status;
            })
            .catch(error => {
                console.warn('Não foi possível consultar o status do Google Drive:', error);
                if (error?.code === 'drive_not_connected' || error?.status === 404) {
                    const config = configDrive();
                    config.conectado = false;
                    config.pastaId = '';
                    config.email = '';
                    persistirDrive();
                }
                renderizarStatusDrive();
                return { connected: configDrive().conectado === true, unavailable: true };
            })
            .finally(() => { carregandoStatus = null; });
        return carregandoStatus;
    }

    async function obterTokenDrive(forcar = false) {
        if (!forcar && accessToken && Date.now() < tokenExpiresAt - 60000) return accessToken;
        const resposta = await requisicaoDriveGugetFin('/drive/token', {
            method: 'POST',
            body: '{}'
        });
        accessToken = resposta.accessToken;
        tokenExpiresAt = Date.now() + (Number(resposta.expiresIn || 3600) * 1000);
        const config = configDrive();
        config.conectado = true;
        if (resposta.receiptsFolderId) config.pastaId = resposta.receiptsFolderId;
        return accessToken;
    }

    async function driveFetch(url, opcoes = {}, repetir = true) {
        const token = await obterTokenDrive(false);
        const headers = new Headers(opcoes.headers || {});
        headers.set('Authorization', `Bearer ${token}`);
        const resposta = await fetch(url, { ...opcoes, headers });
        if (resposta.status === 401 && repetir) {
            accessToken = '';
            return driveFetch(url, opcoes, false);
        }
        if (!resposta.ok) {
            let detalhe = '';
            try { detalhe = (await resposta.json())?.error?.message || ''; } catch (_) {}
            throw new Error(detalhe || `Google Drive respondeu com erro ${resposta.status}.`);
        }
        return resposta;
    }

    async function garantirPastaComprovantes() {
        const config = configDrive();
        if (config.pastaId) return config.pastaId;
        await obterTokenDrive(true);
        if (!config.pastaId) throw new Error('A pasta de comprovantes não foi encontrada. Reconecte o Google Drive.');
        persistirDrive();
        return config.pastaId;
    }

    function nomeSeguroArquivo(file, contexto) {
        const extensao = (file.name.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0];
        const data = new Date().toISOString().replace(/[:.]/g, '-');
        return `${contexto || 'comprovante'}-${data}${extensao}`;
    }

    async function uploadMultipart(file, pastaId, contexto) {
        const boundary = `gugetfin_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const metadata = {
            name: nomeSeguroArquivo(file, contexto),
            mimeType: file.type || 'image/jpeg',
            parents: [pastaId]
        };
        const inicio = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`;
        const fim = `\r\n--${boundary}--`;
        const corpo = new Blob([inicio, await file.arrayBuffer(), fim], { type: `multipart/related; boundary=${boundary}` });
        const resposta = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType', {
            method: 'POST',
            headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
            body: corpo
        });
        return resposta.json();
    }

    function aguardarRetornoOAuth(popup) {
        return new Promise((resolve, reject) => {
            let concluido = false;
            let limite = null;
            const encerrar = (erro, resultado) => {
                if (concluido) return;
                concluido = true;
                window.removeEventListener('message', aoReceberMensagem);
                clearInterval(vigia);
                clearTimeout(limite);
                erro ? reject(erro) : resolve(resultado);
            };
            const aoReceberMensagem = event => {
                if (event.origin !== DRIVE_API_ORIGIN || event.data?.type !== 'gugetfin-drive-oauth') return;
                if (event.data.success) encerrar(null, event.data);
                else encerrar(new Error(event.data.message || 'A autorização do Google Drive não foi concluída.'));
            };
            window.addEventListener('message', aoReceberMensagem);
            const vigia = setInterval(() => {
                if (popup?.closed) encerrar(new Error('A janela de autorização foi fechada.'));
            }, 500);
            limite = setTimeout(() => encerrar(new Error('A autorização demorou mais que o esperado.')), 10 * 60 * 1000);
        });
    }

    function renderizarStatusDrive() {
        const config = configDrive();
        const conectado = config.conectado === true;
        const pill = document.getElementById('settings-drive-status-pill');
        const texto = document.getElementById('settings-drive-status-text');
        const conectar = document.getElementById('btn-connect-drive');
        const desconectar = document.getElementById('btn-disconnect-drive');
        if (pill) {
            pill.textContent = conectado ? 'Conectado' : 'Não conectado';
            pill.classList.toggle('is-connected', conectado);
        }
        if (texto) {
            texto.textContent = conectado
                ? `Conectado como ${config.email || window.auth?.currentUser?.email || 'conta Google'}`
                : 'Salve comprovantes e backups no seu próprio Drive.';
        }
        const pasta = document.getElementById('settings-drive-folder');
        if (pasta) pasta.textContent = 'Pastas GugetFin / Comprovantes e Backups';
        if (conectar) conectar.style.display = conectado ? 'none' : '';
        if (desconectar) desconectar.style.display = conectado ? '' : 'none';
    }

    window.usarGoogleDriveComprovantes = function () {
        return configDrive().conectado === true;
    };

    window.enviarImagemGugetDrive = async function (file, contexto = 'comprovante') {
        const arquivo = typeof comprimirImagem === 'function' ? await comprimirImagem(file) : file;
        const pastaId = await garantirPastaComprovantes();
        const enviado = await uploadMultipart(arquivo, pastaId, contexto);
        return `${DRIVE_PREFIX}${enviado.id}`;
    };

    window.abrirComprovanteGuget = async function (referencia) {
        if (!referencia) return;
        if (!String(referencia).startsWith(DRIVE_PREFIX)) {
            document.getElementById('img-comprovante-preview').src = referencia;
            document.getElementById('modal-ver-comprovante').showModal();
            return;
        }
        try {
            const fileId = String(referencia).slice(DRIVE_PREFIX.length);
            const resposta = await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
            const blob = await resposta.blob();
            const url = URL.createObjectURL(blob);
            const imagem = document.getElementById('img-comprovante-preview');
            imagem.onload = () => URL.revokeObjectURL(url);
            imagem.src = url;
            document.getElementById('modal-ver-comprovante').showModal();
        } catch (erro) {
            alert('Não foi possível abrir o comprovante: ' + erro.message);
        }
    };

    window.conectarGoogleDrive = async function () {
        const botao = document.getElementById('btn-connect-drive');
        const popup = window.open('about:blank', 'gugetfin_drive_oauth', 'width=520,height=720,resizable=yes,scrollbars=yes');
        try {
            if (botao) { botao.disabled = true; botao.textContent = 'Conectando...'; }
            const inicio = await requisicaoDriveGugetFin('/drive/oauth/start', {
                method: 'POST',
                body: JSON.stringify({ origin: window.location.origin })
            });
            if (!popup) {
                window.location.assign(inicio.authorizationUrl);
                return;
            }
            popup.location.replace(inicio.authorizationUrl);
            await aguardarRetornoOAuth(popup);
            accessToken = '';
            tokenExpiresAt = 0;
            statusCarregadoEm = 0;
            await carregarStatusDrive(true);
            await obterTokenDrive(true);
            persistirDrive();
            renderizarStatusDrive();
            if (typeof mostrarToast === 'function') mostrarToast('Google Drive conectado de forma permanente!');
        } catch (erro) {
            if (popup && !popup.closed) popup.close();
            alert('Não foi possível conectar o Google Drive: ' + erro.message);
        } finally {
            if (botao) { botao.disabled = false; botao.textContent = 'Conectar Google Drive'; }
        }
    };

    window.desconectarGoogleDrive = async function () {
        if (!confirm('Desconectar o Google Drive? Os comprovantes e backups já enviados não serão apagados.')) return;
        const botao = document.getElementById('btn-disconnect-drive');
        try {
            if (botao) { botao.disabled = true; botao.textContent = 'Desconectando...'; }
            await requisicaoDriveGugetFin('/drive/connection', { method: 'DELETE' });
            accessToken = '';
            tokenExpiresAt = 0;
            statusCarregadoEm = Date.now();
            const config = configDrive();
            config.conectado = false;
            config.pastaId = '';
            config.email = '';
            persistirDrive();
            renderizarStatusDrive();
            if (typeof mostrarToast === 'function') mostrarToast('Google Drive desconectado.');
        } catch (erro) {
            alert('Não foi possível desconectar o Google Drive: ' + erro.message);
        } finally {
            if (botao) { botao.disabled = false; botao.textContent = 'Desconectar Drive'; }
        }
    };

    window.criarBackupGoogleDriveAgora = async function () {
        if (configDrive().conectado !== true) return null;
        return requisicaoDriveGugetFin('/drive/backup', { method: 'POST', body: '{}' });
    };

    window.atualizarInterfaceGoogleDrive = function () {
        renderizarStatusDrive();
        carregarStatusDrive(false);
    };

    document.addEventListener('DOMContentLoaded', renderizarStatusDrive);
})();
