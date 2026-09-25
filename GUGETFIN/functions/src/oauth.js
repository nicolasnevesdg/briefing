const {
    createHash,
    randomBytes,
    timingSafeEqual
} = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { ApiError, texto } = require('./domain');

const ALEXA_CLIENT_ID = 'gugetfin-alexa';
const COLECAO_CHAVES = '_gugetApiKeys';
const COLECAO_CODIGOS = '_gugetOAuthCodes';
const COLECAO_REFRESH = '_gugetOAuthRefreshTokens';
const SUBCOLECAO_INTEGRACOES = 'integracoesApi';
const ESCOPOS_ALEXA = ['profile:read', 'transactions:read', 'transactions:write'];
const DURACAO_CODIGO_MS = 5 * 60 * 1000;
const DURACAO_ACCESS_TOKEN_MS = 60 * 60 * 1000;
const HOSTS_REDIRECT_ALEXA = new Set([
    'pitangui.amazon.com',
    'layla.amazon.com',
    'alexa.amazon.co.jp'
]);

function hash(valor) {
    return createHash('sha256').update(String(valor)).digest('hex');
}

function compararSegredo(recebido, esperado) {
    const a = Buffer.from(String(recebido || ''));
    const b = Buffer.from(String(esperado || ''));
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function validarRedirectAlexa(valor) {
    try {
        const url = new URL(String(valor || ''));
        return url.protocol === 'https:'
            && HOSTS_REDIRECT_ALEXA.has(url.hostname)
            && /^\/api\/skill\/link\/[A-Za-z0-9]+\/?$/.test(url.pathname)
            && !url.username
            && !url.password;
    } catch (error) {
        return false;
    }
}

function validarPkce(codeVerifier, codeChallenge, method = 'S256') {
    if (!codeChallenge) return true;
    if (method !== 'S256' || !/^[A-Za-z0-9._~-]{43,128}$/.test(String(codeVerifier || ''))) return false;
    const calculado = createHash('sha256')
        .update(String(codeVerifier))
        .digest('base64url');
    return compararSegredo(calculado, codeChallenge);
}

function extrairCredenciaisCliente(req) {
    const authorization = String(req.headers?.authorization || '');
    if (/^Basic\s+/i.test(authorization)) {
        try {
            const decodificado = Buffer.from(authorization.replace(/^Basic\s+/i, ''), 'base64').toString('utf8');
            const separador = decodificado.indexOf(':');
            if (separador >= 0) {
                return {
                    clientId: decodificado.slice(0, separador),
                    clientSecret: decodificado.slice(separador + 1)
                };
            }
        } catch (error) {}
    }
    return {
        clientId: String(req.body?.client_id || ''),
        clientSecret: String(req.body?.client_secret || '')
    };
}

function respostaOAuthErro(res, status, error, description) {
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    return res.status(status).json({
        error,
        ...(description ? { error_description: description } : {})
    });
}

function criarCredenciais(uid, keyIdExistente = null) {
    const keyId = keyIdExistente || randomBytes(9).toString('base64url');
    const accessToken = `ggf_live_${keyId}_${randomBytes(32).toString('base64url')}`;
    const refreshToken = keyIdExistente
        ? null
        : `ggf_refresh_${keyId}_${randomBytes(40).toString('base64url')}`;
    return {
        uid,
        keyId,
        accessToken,
        accessTokenHash: hash(accessToken),
        refreshToken,
        refreshTokenHash: refreshToken ? hash(refreshToken) : null,
        expiresAtMs: Date.now() + DURACAO_ACCESS_TOKEN_MS
    };
}

async function autorizarAlexa(servicos, contexto, body) {
    const clientId = texto(body?.client_id, 120);
    const redirectUri = String(body?.redirect_uri || '');
    const state = texto(body?.state, 1200);
    const responseType = texto(body?.response_type, 30);
    const codeChallenge = texto(body?.code_challenge, 180);
    const codeChallengeMethod = texto(body?.code_challenge_method || (codeChallenge ? 'S256' : ''), 20);

    if (clientId !== ALEXA_CLIENT_ID || responseType !== 'code') {
        throw new ApiError(400, 'invalid_oauth_request', 'A solicitação de vinculação da Alexa é inválida.');
    }
    if (!state || !validarRedirectAlexa(redirectUri)) {
        throw new ApiError(400, 'invalid_redirect_uri', 'O endereço de retorno da Alexa não é válido.');
    }
    if (codeChallenge && (codeChallengeMethod !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge))) {
        throw new ApiError(400, 'invalid_code_challenge', 'A proteção PKCE recebida é inválida.');
    }

    const code = randomBytes(32).toString('base64url');
    const agoraMs = Date.now();
    await servicos.db.collection(COLECAO_CODIGOS).doc(hash(code)).create({
        uid: contexto.uid,
        clientId,
        redirectUri,
        scopes: ESCOPOS_ALEXA,
        codeChallenge: codeChallenge || null,
        codeChallengeMethod: codeChallenge ? 'S256' : null,
        createdAt: FieldValue.serverTimestamp(),
        expiresAtMs: agoraMs + DURACAO_CODIGO_MS,
        usedAt: null
    });

    const retorno = new URL(redirectUri);
    retorno.searchParams.set('code', code);
    retorno.searchParams.set('state', state);
    return { redirectUri: retorno.toString() };
}

async function trocarAuthorizationCode(servicos, body) {
    const code = String(body?.code || '');
    const redirectUri = String(body?.redirect_uri || '');
    const codeVerifier = String(body?.code_verifier || '');
    if (!code || !validarRedirectAlexa(redirectUri)) {
        throw new Error('invalid_grant');
    }

    const codeRef = servicos.db.collection(COLECAO_CODIGOS).doc(hash(code));
    let emitidos;
    await servicos.db.runTransaction(async transaction => {
        const snap = await transaction.get(codeRef);
        const dados = snap.exists ? snap.data() : null;
        if (!dados
            || dados.usedAt
            || Number(dados.expiresAtMs || 0) < Date.now()
            || dados.clientId !== ALEXA_CLIENT_ID
            || dados.redirectUri !== redirectUri
            || !validarPkce(codeVerifier, dados.codeChallenge, dados.codeChallengeMethod || 'S256')) {
            throw new Error('invalid_grant');
        }

        emitidos = criarCredenciais(dados.uid);
        const criadoEm = FieldValue.serverTimestamp();
        const accessRef = servicos.db.collection(COLECAO_CHAVES).doc(emitidos.accessTokenHash);
        const refreshRef = servicos.db.collection(COLECAO_REFRESH).doc(emitidos.refreshTokenHash);
        const integracaoRef = servicos.db.collection('usuarios').doc(dados.uid)
            .collection(SUBCOLECAO_INTEGRACOES).doc(emitidos.keyId);

        transaction.update(codeRef, { usedAt: criadoEm });
        transaction.create(accessRef, {
            uid: dados.uid,
            keyId: emitidos.keyId,
            name: 'Alexa',
            prefix: 'Alexa · conta vinculada',
            scopes: ESCOPOS_ALEXA,
            source: 'alexa',
            createdAt: criadoEm,
            lastUsedAt: null,
            expiresAtMs: emitidos.expiresAtMs,
            revokedAt: null
        });
        transaction.create(refreshRef, {
            uid: dados.uid,
            keyId: emitidos.keyId,
            clientId: ALEXA_CLIENT_ID,
            scopes: ESCOPOS_ALEXA,
            accessTokenHash: emitidos.accessTokenHash,
            createdAt: criadoEm,
            revokedAt: null
        });
        transaction.create(integracaoRef, {
            name: 'Alexa',
            prefix: 'Alexa · conta vinculada',
            scopes: ESCOPOS_ALEXA,
            source: 'alexa',
            tokenHash: emitidos.accessTokenHash,
            refreshTokenHash: emitidos.refreshTokenHash,
            createdAt: criadoEm,
            lastUsedAt: null,
            revokedAt: null
        });
    });
    return emitidos;
}

async function renovarAccessToken(servicos, body) {
    const refreshToken = String(body?.refresh_token || '');
    if (!refreshToken.startsWith('ggf_refresh_')) throw new Error('invalid_grant');
    const refreshHash = hash(refreshToken);
    const refreshRef = servicos.db.collection(COLECAO_REFRESH).doc(refreshHash);
    let emitidos;

    await servicos.db.runTransaction(async transaction => {
        const snap = await transaction.get(refreshRef);
        const dados = snap.exists ? snap.data() : null;
        if (!dados || dados.revokedAt || dados.clientId !== ALEXA_CLIENT_ID) throw new Error('invalid_grant');

        emitidos = criarCredenciais(dados.uid, dados.keyId);
        const accessRef = servicos.db.collection(COLECAO_CHAVES).doc(emitidos.accessTokenHash);
        const integracaoRef = servicos.db.collection('usuarios').doc(dados.uid)
            .collection(SUBCOLECAO_INTEGRACOES).doc(dados.keyId);
        if (dados.accessTokenHash) {
            transaction.delete(servicos.db.collection(COLECAO_CHAVES).doc(dados.accessTokenHash));
        }
        transaction.create(accessRef, {
            uid: dados.uid,
            keyId: dados.keyId,
            name: 'Alexa',
            prefix: 'Alexa · conta vinculada',
            scopes: Array.isArray(dados.scopes) ? dados.scopes : ESCOPOS_ALEXA,
            source: 'alexa',
            createdAt: FieldValue.serverTimestamp(),
            lastUsedAt: null,
            expiresAtMs: emitidos.expiresAtMs,
            revokedAt: null
        });
        transaction.update(refreshRef, {
            accessTokenHash: emitidos.accessTokenHash,
            refreshedAt: FieldValue.serverTimestamp()
        });
        transaction.set(integracaoRef, {
            tokenHash: emitidos.accessTokenHash,
            refreshedAt: FieldValue.serverTimestamp()
        }, { merge: true });
    });
    return emitidos;
}

async function endpointTokenAlexa(servicos, req, res) {
    const esperadoBruto = typeof servicos.getAlexaClientSecret === 'function'
        ? servicos.getAlexaClientSecret()
        : servicos.alexaClientSecret;
    const esperado = String(esperadoBruto || '').trim();
    const credenciais = extrairCredenciaisCliente(req);
    if (credenciais.clientId !== ALEXA_CLIENT_ID || !compararSegredo(credenciais.clientSecret, esperado)) {
        res.set('WWW-Authenticate', 'Basic realm="GugetFin Alexa OAuth"');
        return respostaOAuthErro(res, 401, 'invalid_client', 'Credenciais do cliente inválidas.');
    }

    try {
        let emitidos;
        const grantType = String(req.body?.grant_type || '');
        if (grantType === 'authorization_code') {
            emitidos = await trocarAuthorizationCode(servicos, req.body || {});
        } else if (grantType === 'refresh_token') {
            emitidos = await renovarAccessToken(servicos, req.body || {});
        } else {
            return respostaOAuthErro(res, 400, 'unsupported_grant_type', 'Tipo de autorização não suportado.');
        }

        res.set('Cache-Control', 'no-store');
        res.set('Pragma', 'no-cache');
        return res.status(200).json({
            access_token: emitidos.accessToken,
            token_type: 'Bearer',
            expires_in: Math.floor(DURACAO_ACCESS_TOKEN_MS / 1000),
            ...(emitidos.refreshToken ? { refresh_token: emitidos.refreshToken } : {})
        });
    } catch (error) {
        if (error?.message === 'invalid_grant') {
            return respostaOAuthErro(res, 400, 'invalid_grant', 'Código ou token de renovação inválido.');
        }
        servicos.logger.error('Erro no endpoint OAuth da Alexa', error);
        return respostaOAuthErro(res, 500, 'server_error', 'Não foi possível concluir a vinculação.');
    }
}

module.exports = {
    ALEXA_CLIENT_ID,
    autorizarAlexa,
    endpointTokenAlexa,
    extrairCredenciaisCliente,
    validarPkce,
    validarRedirectAlexa
};
