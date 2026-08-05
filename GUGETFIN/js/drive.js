(function () {
    const CLIENT_ID = '626285959649-a7e0faqjb43psugsbmqt9ptfjo63nvp3.apps.googleusercontent.com';
    const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
    const DRIVE_PREFIX = 'drive://';
    let tokenClient = null;
    let accessToken = '';
    let tokenExpiresAt = 0;

    function configDrive() {
        if (!salsiData.config) salsiData.config = {};
        if (!salsiData.config.googleDrive) salsiData.config.googleDrive = { conectado: false, pastaId: '' };
        return salsiData.config.googleDrive;
    }

    function persistirDrive() {
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
    }

    function aguardarGoogleIdentity() {
        return new Promise((resolve, reject) => {
            let tentativas = 0;
            const verificar = () => {
                if (window.google?.accounts?.oauth2) return resolve();
                if (++tentativas > 80) return reject(new Error('O serviço de autorização do Google não carregou.'));
                setTimeout(verificar, 100);
            };
            verificar();
        });
    }

    async function obterTokenDrive(forcarConsentimento = false) {
        if (accessToken && Date.now() < tokenExpiresAt - 60000) return accessToken;
        await aguardarGoogleIdentity();
        return new Promise((resolve, reject) => {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: DRIVE_SCOPE,
                callback: resposta => {
                    if (resposta?.error) return reject(new Error(resposta.error_description || resposta.error));
                    accessToken = resposta.access_token;
                    tokenExpiresAt = Date.now() + (Number(resposta.expires_in || 3600) * 1000);
                    resolve(accessToken);
                },
                error_callback: erro => reject(new Error(erro?.message || 'Autorização do Google cancelada.'))
            });
            tokenClient.requestAccessToken({ prompt: forcarConsentimento ? 'consent' : '' });
        });
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

    async function criarPasta(nome, parentId = 'root') {
        const resposta = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
        });
        return resposta.json();
    }

    async function garantirPastaComprovantes() {
        const config = configDrive();
        if (config.pastaId) {
            try {
                await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(config.pastaId)}?fields=id`);
                return config.pastaId;
            } catch (_) { config.pastaId = ''; }
        }
        const raiz = await criarPasta('GugetFin');
        const comprovantes = await criarPasta('Comprovantes', raiz.id);
        config.pastaId = comprovantes.id;
        persistirDrive();
        return comprovantes.id;
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
        try {
            if (botao) { botao.disabled = true; botao.textContent = 'Conectando...'; }
            await obterTokenDrive(true);
            await garantirPastaComprovantes();
            configDrive().conectado = true;
            persistirDrive();
            atualizarInterfaceGoogleDrive();
            if (typeof mostrarToast === 'function') mostrarToast('Google Drive conectado com sucesso!');
        } catch (erro) {
            alert('Não foi possível conectar o Google Drive: ' + erro.message);
        } finally {
            if (botao) { botao.disabled = false; botao.textContent = 'Conectar Google Drive'; }
        }
    };

    window.desconectarGoogleDrive = function () {
        if (!confirm('Desconectar o Google Drive? Os comprovantes já enviados não serão apagados.')) return;
        if (accessToken && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(accessToken);
        accessToken = '';
        tokenExpiresAt = 0;
        configDrive().conectado = false;
        persistirDrive();
        atualizarInterfaceGoogleDrive();
    };

    window.atualizarInterfaceGoogleDrive = function () {
        const conectado = configDrive().conectado === true;
        const pill = document.getElementById('settings-drive-status-pill');
        const texto = document.getElementById('settings-drive-status-text');
        const conectar = document.getElementById('btn-connect-drive');
        const desconectar = document.getElementById('btn-disconnect-drive');
        if (pill) { pill.textContent = conectado ? 'Conectado' : 'Não conectado'; pill.classList.toggle('is-connected', conectado); }
        if (texto) texto.textContent = conectado ? `Conectado como ${window.auth?.currentUser?.email || 'conta Google'}` : 'Salve comprovantes no seu próprio Drive.';
        if (conectar) conectar.style.display = conectado ? 'none' : '';
        if (desconectar) desconectar.style.display = conectado ? '' : 'none';
    };

    document.addEventListener('DOMContentLoaded', atualizarInterfaceGoogleDrive);
})();
