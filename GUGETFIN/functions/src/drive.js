const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { ApiError } = require('./domain');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const COLECAO_CONEXOES = '_gugetDriveConnections';
const COLECAO_ESTADOS = '_gugetDriveOAuthStates';
const DURACAO_ESTADO_MS = 10 * 60 * 1000;
const ORIGENS_PERMITIDAS = new Set([
    'https://nicolasneves.com.br',
    'https://www.nicolasneves.com.br',
    'https://nicolasnevesdg.github.io'
]);

function hash(valor) {
    return createHash('sha256').update(String(valor)).digest('hex');
}

function chaveCriptografia(servicos) {
    const valor = String(servicos.getGoogleDriveEncryptionKey?.() || '').trim();
    let chave;
    try {
        chave = Buffer.from(valor, 'base64');
    } catch (_) {
        chave = Buffer.alloc(0);
    }
    if (chave.length !== 32) {
        throw new Error('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY precisa conter 32 bytes em base64.');
    }
    return chave;
}

function criptografarToken(servicos, token) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', chaveCriptografia(servicos), iv);
    const conteudo = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${conteudo.toString('base64url')}`;
}

function descriptografarToken(servicos, valor) {
    const [versao, iv, tag, conteudo] = String(valor || '').split('.');
    if (versao !== 'v1' || !iv || !tag || !conteudo) throw new Error('Token do Drive inválido.');
    const decipher = createDecipheriv('aes-256-gcm', chaveCriptografia(servicos), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(conteudo, 'base64url')),
        decipher.final()
    ]).toString('utf8');
}

function origemRetorno(servicos, origemSolicitada) {
    const origemPublica = new URL(servicos.publicSiteUrl).origin;
    const origem = String(origemSolicitada || '').trim();
    if (ORIGENS_PERMITIDAS.has(origem)) return origem;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem)) return origem;
    return origemPublica;
}

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function lerJson(response, mensagem) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const detalhe = payload?.error_description || payload?.error?.message || payload?.error || mensagem;
        throw new ApiError(502, 'google_drive_error', String(detalhe || mensagem));
    }
    return payload;
}

async function postForm(servicos, url, campos) {
    const response = await (servicos.fetch || fetch)(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(campos)
    });
    return lerJson(response, 'O Google Drive não respondeu como esperado.');
}

async function requisicaoDrive(servicos, accessToken, url, opcoes = {}) {
    const headers = new Headers(opcoes.headers || {});
    headers.set('Authorization', `Bearer ${accessToken}`);
    const response = await (servicos.fetch || fetch)(url, { ...opcoes, headers });
    return lerJson(response, 'Não foi possível acessar o Google Drive.');
}

function escaparBuscaDrive(valor) {
    return String(valor).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function garantirPasta(servicos, accessToken, nome, parentId = 'root') {
    const q = [
        `name = '${escaparBuscaDrive(nome)}'`,
        "mimeType = 'application/vnd.google-apps.folder'",
        'trashed = false',
        `'${escaparBuscaDrive(parentId)}' in parents`
    ].join(' and ');
    const busca = new URL('https://www.googleapis.com/drive/v3/files');
    busca.searchParams.set('q', q);
    busca.searchParams.set('fields', 'files(id,name)');
    busca.searchParams.set('pageSize', '1');
    const encontrados = await requisicaoDrive(servicos, accessToken, busca.toString());
    if (encontrados.files?.[0]?.id) return encontrados.files[0].id;

    const criado = await requisicaoDrive(servicos, accessToken, 'https://www.googleapis.com/drive/v3/files?fields=id,name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: nome,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        })
    });
    return criado.id;
}

async function garantirEstruturaDrive(servicos, accessToken) {
    const rootFolderId = await garantirPasta(servicos, accessToken, 'GugetFin');
    const [receiptsFolderId, backupsFolderId] = await Promise.all([
        garantirPasta(servicos, accessToken, 'Comprovantes', rootFolderId),
        garantirPasta(servicos, accessToken, 'Backups', rootFolderId)
    ]);
    return { rootFolderId, receiptsFolderId, backupsFolderId };
}

async function trocarCodigoPorTokens(servicos, codigo) {
    return postForm(servicos, 'https://oauth2.googleapis.com/token', {
        code: codigo,
        client_id: servicos.googleDriveClientId,
        client_secret: servicos.getGoogleDriveClientSecret(),
        redirect_uri: servicos.googleDriveRedirectUri,
        grant_type: 'authorization_code'
    });
}

async function renovarAccessToken(servicos, refreshToken) {
    const tokens = await postForm(servicos, 'https://oauth2.googleapis.com/token', {
        refresh_token: refreshToken,
        client_id: servicos.googleDriveClientId,
        client_secret: servicos.getGoogleDriveClientSecret(),
        grant_type: 'refresh_token'
    });
    if (!tokens.access_token) throw new ApiError(502, 'drive_token_failed', 'O Google não renovou o acesso ao Drive.');
    return tokens;
}

async function iniciarOAuthDrive(servicos, contexto, body = {}) {
    const state = randomBytes(32).toString('base64url');
    const stateHash = hash(state);
    const origin = origemRetorno(servicos, body.origin);
    await servicos.db.collection(COLECAO_ESTADOS).doc(stateHash).set({
        uid: contexto.uid,
        origin,
        expiresAtMs: Date.now() + DURACAO_ESTADO_MS,
        createdAt: FieldValue.serverTimestamp()
    });

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', servicos.googleDriveClientId);
    url.searchParams.set('redirect_uri', servicos.googleDriveRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', `openid email ${DRIVE_SCOPE}`);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    return { authorizationUrl: url.toString(), expiresIn: Math.floor(DURACAO_ESTADO_MS / 1000) };
}

function paginaRetornoDrive({ origin, success, message }) {
    const destino = String(origin || 'https://nicolasneves.com.br');
    const payload = JSON.stringify({ type: 'gugetfin-drive-oauth', success, message });
    const destinoJson = JSON.stringify(destino);
    const titulo = escaparHtml(success ? 'Google Drive conectado' : 'Não foi possível conectar');
    const texto = escaparHtml(success
        ? 'Conexão concluída. Esta janela pode ser fechada.'
        : String(message || 'A autorização não foi concluída.'));
    const link = escaparHtml(`${destino}/GUGETFIN/index.html`);
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><style>body{margin:0;background:#0d1014;color:#fff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.card{max-width:420px;margin:24px;padding:28px;border:1px solid #27303a;border-radius:18px;background:#151a20;text-align:center}h1{font-size:22px;margin:0 0 10px;color:#28df8b}p{color:#b8c2cc;line-height:1.5}a{color:#28df8b}</style></head><body><main class="card"><h1>${titulo}</h1><p>${texto}</p><p><a href="${link}">Voltar ao GugetFin</a></p></main><script>if(window.opener){window.opener.postMessage(${payload},${destinoJson});setTimeout(()=>window.close(),700);}</script></body></html>`;
}

async function concluirOAuthDrive(servicos, query = {}) {
    const state = String(query.state || '');
    const stateRef = servicos.db.collection(COLECAO_ESTADOS).doc(hash(state));
    const stateSnap = state ? await stateRef.get() : null;
    const stateData = stateSnap?.exists ? stateSnap.data() : null;
    const origin = origemRetorno(servicos, stateData?.origin);

    if (!stateData || Number(stateData.expiresAtMs || 0) < Date.now()) {
        return { status: 400, html: paginaRetornoDrive({ origin, success: false, message: 'Esta autorização expirou. Tente conectar novamente.' }) };
    }
    await stateRef.delete();

    if (query.error) {
        return { status: 400, html: paginaRetornoDrive({ origin, success: false, message: 'A autorização do Google Drive foi cancelada.' }) };
    }

    try {
        const tokens = await trocarCodigoPorTokens(servicos, String(query.code || ''));
        if (!tokens.refresh_token || !tokens.access_token) {
            throw new ApiError(502, 'drive_refresh_token_missing', 'O Google não forneceu autorização permanente. Tente novamente.');
        }
        const userInfo = await requisicaoDrive(servicos, tokens.access_token, 'https://openidconnect.googleapis.com/v1/userinfo');
        const pastas = await garantirEstruturaDrive(servicos, tokens.access_token);
        await servicos.db.collection(COLECAO_CONEXOES).doc(stateData.uid).set({
            uid: stateData.uid,
            connected: true,
            email: String(userInfo.email || ''),
            refreshTokenEncrypted: criptografarToken(servicos, tokens.refresh_token),
            scopes: String(tokens.scope || `${DRIVE_SCOPE} openid email`).split(/\s+/).filter(Boolean),
            ...pastas,
            updatedAt: FieldValue.serverTimestamp(),
            connectedAt: FieldValue.serverTimestamp(),
            lastError: null
        }, { merge: true });
        return { status: 200, html: paginaRetornoDrive({ origin, success: true }) };
    } catch (error) {
        servicos.logger.error('Falha ao concluir OAuth do Google Drive', error);
        return { status: 502, html: paginaRetornoDrive({ origin, success: false, message: 'Não foi possível concluir a conexão com o Google Drive.' }) };
    }
}

async function carregarConexao(servicos, uid) {
    const ref = servicos.db.collection(COLECAO_CONEXOES).doc(uid);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.connected !== true) {
        throw new ApiError(404, 'drive_not_connected', 'Conecte o Google Drive para continuar.');
    }
    return { ref, dados: snap.data() };
}

async function obterStatusDrive(servicos, contexto) {
    const snap = await servicos.db.collection(COLECAO_CONEXOES).doc(contexto.uid).get();
    if (!snap.exists || snap.data()?.connected !== true) return { connected: false };
    const dados = snap.data();
    return {
        connected: true,
        email: dados.email || '',
        folder: 'GugetFin / Comprovantes',
        automaticBackup: true,
        lastBackupAt: dados.lastBackupAt?.toDate?.().toISOString?.() || null
    };
}

async function obterAccessTokenDrive(servicos, contexto) {
    const conexao = await carregarConexao(servicos, contexto.uid);
    try {
        const refreshToken = descriptografarToken(servicos, conexao.dados.refreshTokenEncrypted);
        const tokens = await renovarAccessToken(servicos, refreshToken);
        await conexao.ref.set({ updatedAt: FieldValue.serverTimestamp(), lastError: null }, { merge: true });
        return {
            accessToken: tokens.access_token,
            expiresIn: Number(tokens.expires_in || 3600),
            receiptsFolderId: conexao.dados.receiptsFolderId
        };
    } catch (error) {
        await conexao.ref.set({ lastError: 'token_refresh_failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        throw error;
    }
}

async function desconectarDrive(servicos, contexto) {
    const ref = servicos.db.collection(COLECAO_CONEXOES).doc(contexto.uid);
    const snap = await ref.get();
    if (!snap.exists) return { disconnected: true };
    try {
        const refreshToken = descriptografarToken(servicos, snap.data().refreshTokenEncrypted);
        await (servicos.fetch || fetch)('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: refreshToken })
        });
    } catch (error) {
        servicos.logger.warn('Não foi possível revogar o token do Google Drive', error);
    }
    await ref.delete();
    return { disconnected: true };
}

function nomeBackup(agora = new Date()) {
    const data = agora.toISOString().slice(0, 10);
    const hora = agora.toISOString().slice(11, 16).replace(':', 'h');
    return `GugetFin_Backup_${data}_${hora}.js`;
}

async function enviarBackup(servicos, accessToken, folderId, dados, agora = new Date()) {
    const boundary = `gugetfin_${randomBytes(12).toString('hex')}`;
    const metadata = JSON.stringify({
        name: nomeBackup(agora),
        mimeType: 'text/javascript',
        parents: [folderId]
    });
    const arquivo = `const bancoInicial = ${JSON.stringify(dados, null, 2)};`;
    const corpo = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/javascript; charset=UTF-8\r\n\r\n`, 'utf8'),
        Buffer.from(arquivo, 'utf8'),
        Buffer.from(`\r\n--${boundary}--`, 'utf8')
    ]);
    return requisicaoDrive(servicos, accessToken, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: corpo
    });
}

async function criarBackupDrive(servicos, contexto) {
    const conexao = await carregarConexao(servicos, contexto.uid);
    const usuario = await servicos.db.collection('usuarios').doc(contexto.uid).get();
    if (!usuario.exists) throw new ApiError(404, 'user_not_found', 'Conta do GugetFin não encontrada.');
    const refreshToken = descriptografarToken(servicos, conexao.dados.refreshTokenEncrypted);
    const tokens = await renovarAccessToken(servicos, refreshToken);
    const arquivo = await enviarBackup(servicos, tokens.access_token, conexao.dados.backupsFolderId, usuario.data()?.dados || {});
    await conexao.ref.set({
        lastBackupAt: FieldValue.serverTimestamp(),
        lastBackupFileId: arquivo.id,
        lastError: null,
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { created: true, name: arquivo.name };
}

async function executarBackupsSemanais(servicos) {
    const conexoes = await servicos.db.collection(COLECAO_CONEXOES).where('connected', '==', true).get();
    const resultado = { processed: 0, succeeded: 0, failed: 0 };
    for (const doc of conexoes.docs) {
        resultado.processed += 1;
        try {
            await criarBackupDrive(servicos, { uid: doc.id });
            resultado.succeeded += 1;
        } catch (error) {
            resultado.failed += 1;
            servicos.logger.error(`Falha no backup semanal do usuário ${doc.id}`, error);
            await doc.ref.set({
                lastError: 'weekly_backup_failed',
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
        }
    }
    return resultado;
}

module.exports = {
    DRIVE_SCOPE,
    concluirOAuthDrive,
    criarBackupDrive,
    criptografarToken,
    descriptografarToken,
    desconectarDrive,
    executarBackupsSemanais,
    iniciarOAuthDrive,
    nomeBackup,
    obterAccessTokenDrive,
    obterStatusDrive
};
