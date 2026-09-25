const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const {
    ApiError,
    CATEGORIAS_ENTRADA,
    criarLancamentoApi,
    obterCategorias,
    obterContas,
    serializarLancamento,
    texto
} = require('./domain');
const {
    autorizarAlexa,
    endpointTokenAlexa
} = require('./oauth');

const API_VERSION = '1.1.0';
const COLECAO_CHAVES = '_gugetApiKeys';
const SUBCOLECAO_INTEGRACOES = 'integracoesApi';
const SUBCOLECAO_AUDITORIA = 'apiAuditoria';
const ESCOPOS_PADRAO = ['profile:read', 'transactions:read', 'transactions:write'];
const ORIGENS_PERMITIDAS = new Set([
    'https://nicolasneves.com.br',
    'https://www.nicolasneves.com.br',
    'https://nicolasnevesdg.github.io'
]);

function hash(valor) {
    return createHash('sha256').update(String(valor)).digest('hex');
}

function resposta(res, status, payload, requestId) {
    res.status(status).json({ ...payload, requestId });
}

function erro(res, error, requestId, logger) {
    const conhecido = error instanceof ApiError;
    const status = conhecido ? error.status : 500;
    const code = conhecido ? error.code : 'internal_error';
    const message = conhecido ? error.message : 'Não foi possível concluir a solicitação.';

    if (!conhecido) logger.error('Erro não tratado na API GugetFin', error);
    resposta(res, status, {
        success: false,
        error: {
            code,
            message,
            ...(conhecido && error.details ? { details: error.details } : {})
        }
    }, requestId);
}

function configurarCors(req, res) {
    const origem = req.headers.origin;
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem || '');
    if (origem && (ORIGENS_PERMITIDAS.has(origem) || local)) {
        res.set('Access-Control-Allow-Origin', origem);
        res.set('Vary', 'Origin');
    }
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.set('Access-Control-Max-Age', '3600');
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');

    if (req.method === 'OPTIONS') {
        if (origem && !ORIGENS_PERMITIDAS.has(origem) && !local) {
            throw new ApiError(403, 'origin_not_allowed', 'Origem não autorizada.');
        }
        res.status(204).end();
        return true;
    }
    return false;
}

function caminho(req) {
    const bruto = req.path || new URL(req.url, 'https://api.gugetfin.local').pathname;
    const semBarraFinal = bruto.length > 1 ? bruto.replace(/\/+$/, '') : bruto;
    return semBarraFinal.startsWith('/api/') ? semBarraFinal.slice(4) : semBarraFinal;
}

function tokenBearer(req) {
    const cabecalho = String(req.headers.authorization || '');
    const correspondencia = cabecalho.match(/^Bearer\s+(.+)$/i);
    if (!correspondencia) throw new ApiError(401, 'missing_token', 'Envie um token Bearer no cabeçalho Authorization.');
    return correspondencia[1].trim();
}

function exigirEscopo(contexto, escopo) {
    if (contexto.authType === 'firebase') return;
    if (!contexto.scopes.includes(escopo)) {
        throw new ApiError(403, 'insufficient_scope', `A integração não possui a permissão ${escopo}.`);
    }
}

async function autenticar(req, servicos, somenteFirebase = false) {
    const token = tokenBearer(req);
    if (!token.startsWith('ggf_live_')) {
        try {
            const decodificado = await servicos.auth.verifyIdToken(token, true);
            return {
                uid: decodificado.uid,
                authType: 'firebase',
                keyId: null,
                clientName: 'GugetFin Web',
                scopes: ESCOPOS_PADRAO
            };
        } catch (error) {
            throw new ApiError(401, 'invalid_token', 'Sessão inválida ou expirada.');
        }
    }

    if (somenteFirebase) {
        throw new ApiError(403, 'firebase_login_required', 'Esta ação exige uma sessão ativa no site do GugetFin.');
    }

    const tokenHash = hash(token);
    const ref = servicos.db.collection(COLECAO_CHAVES).doc(tokenHash);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.revokedAt) {
        throw new ApiError(401, 'invalid_api_key', 'Chave de API inválida ou revogada.');
    }

    const dados = snap.data();
    if (dados.expiresAtMs && Number(dados.expiresAtMs) <= Date.now()) {
        throw new ApiError(401, 'expired_token', 'A autorização expirou e precisa ser renovada.');
    }
    const usuarioRef = servicos.db.collection('usuarios').doc(dados.uid);
    const usuarioSnap = await usuarioRef.get();
    if (!usuarioSnap.exists) throw new ApiError(401, 'user_not_found', 'A conta vinculada não existe mais.');

    const usadoEm = FieldValue.serverTimestamp();
    const batch = servicos.db.batch();
    batch.set(ref, { lastUsedAt: usadoEm }, { merge: true });
    batch.set(usuarioRef.collection(SUBCOLECAO_INTEGRACOES).doc(dados.keyId), { lastUsedAt: usadoEm }, { merge: true });
    await batch.commit();

    return {
        uid: dados.uid,
        authType: 'apiKey',
        keyId: dados.keyId,
        clientName: dados.name || 'Integração externa',
        scopes: Array.isArray(dados.scopes) ? dados.scopes : []
    };
}

async function carregarUsuario(db, uid) {
    const ref = db.collection('usuarios').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiError(404, 'user_not_found', 'Conta do GugetFin não encontrada.');
    return { ref, documento: snap.data(), dados: snap.data()?.dados || {} };
}

function timestampIso(valor) {
    if (!valor) return null;
    if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
    if (valor instanceof Date) return valor.toISOString();
    return null;
}

async function listarChaves(servicos, contexto) {
    const snap = await servicos.db.collection('usuarios').doc(contexto.uid).collection(SUBCOLECAO_INTEGRACOES).get();
    return snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => !item.revokedAt)
        .map(item => ({
            id: item.id,
            name: item.name,
            prefix: item.prefix,
            source: item.source || 'apiKey',
            scopes: item.scopes || [],
            createdAt: timestampIso(item.createdAt),
            lastUsedAt: timestampIso(item.lastUsedAt)
        }))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function criarChave(servicos, contexto, body) {
    const name = texto(body?.name || body?.nome, 60);
    if (name.length < 2) throw new ApiError(400, 'invalid_name', 'Dê um nome para identificar o dispositivo.');

    const integracoesRef = servicos.db.collection('usuarios').doc(contexto.uid).collection(SUBCOLECAO_INTEGRACOES);
    const existentes = await integracoesRef.get();
    const ativas = existentes.docs.filter(doc => !doc.data()?.revokedAt);
    if (ativas.length >= 10) {
        throw new ApiError(409, 'key_limit_reached', 'Revogue uma integração antes de criar outra.');
    }

    const keyId = randomBytes(9).toString('base64url');
    const secret = randomBytes(32).toString('base64url');
    const token = `ggf_live_${keyId}_${secret}`;
    const tokenHash = hash(token);
    const prefix = `${token.slice(0, 22)}…`;
    const scopesSolicitados = Array.isArray(body?.scopes) ? body.scopes : ESCOPOS_PADRAO;
    const scopes = ESCOPOS_PADRAO.filter(scope => scopesSolicitados.includes(scope));
    if (!scopes.length) throw new ApiError(400, 'invalid_scopes', 'Selecione ao menos uma permissão.');

    const criadoEm = FieldValue.serverTimestamp();
    const privado = {
        uid: contexto.uid,
        keyId,
        name,
        prefix,
        scopes,
        createdAt: criadoEm,
        lastUsedAt: null,
        revokedAt: null
    };
    const metadata = { ...privado, tokenHash };
    delete metadata.uid;

    const batch = servicos.db.batch();
    batch.create(servicos.db.collection(COLECAO_CHAVES).doc(tokenHash), privado);
    batch.create(integracoesRef.doc(keyId), metadata);
    await batch.commit();

    return { id: keyId, name, prefix, scopes, token };
}

async function revogarChave(servicos, contexto, keyId) {
    const metadataRef = servicos.db.collection('usuarios').doc(contexto.uid).collection(SUBCOLECAO_INTEGRACOES).doc(keyId);
    const metadataSnap = await metadataRef.get();
    if (!metadataSnap.exists || metadataSnap.data()?.revokedAt) {
        throw new ApiError(404, 'key_not_found', 'Integração não encontrada.');
    }
    const tokenHash = metadataSnap.data().tokenHash;
    const refreshTokenHash = metadataSnap.data().refreshTokenHash;
    const revogadoEm = FieldValue.serverTimestamp();
    const batch = servicos.db.batch();
    batch.set(metadataRef, { revokedAt: revogadoEm }, { merge: true });
    batch.set(servicos.db.collection(COLECAO_CHAVES).doc(tokenHash), { revokedAt: revogadoEm }, { merge: true });
    if (refreshTokenHash) {
        batch.set(servicos.db.collection('_gugetOAuthRefreshTokens').doc(refreshTokenHash), { revokedAt: revogadoEm }, { merge: true });
    }
    await batch.commit();
}

async function registrarAuditoria(servicos, contexto, action, details) {
    try {
        await servicos.db.collection('usuarios').doc(contexto.uid).collection(SUBCOLECAO_AUDITORIA).add({
            action,
            keyId: contexto.keyId || null,
            clientName: contexto.clientName,
            details,
            createdAt: FieldValue.serverTimestamp()
        });
    } catch (error) {
        servicos.logger.warn('Não foi possível registrar auditoria da API', error);
    }
}

async function criarTransacao(servicos, contexto, req) {
    exigirEscopo(contexto, 'transactions:write');
    const idempotencyKey = texto(req.headers['idempotency-key'], 160);
    const idempotencyHash = idempotencyKey ? hash(`${contexto.uid}:${idempotencyKey}`) : null;
    const usuarioRef = servicos.db.collection('usuarios').doc(contexto.uid);

    const resultado = await servicos.db.runTransaction(async transaction => {
        const snap = await transaction.get(usuarioRef);
        if (!snap.exists) throw new ApiError(404, 'user_not_found', 'Conta do GugetFin não encontrada.');

        const dados = snap.data()?.dados || {};
        const transacoes = Array.isArray(dados.transacoes) ? [...dados.transacoes] : [];
        const entradas = Array.isArray(dados.entradas) ? [...dados.entradas] : [];
        if (idempotencyHash) {
            const existenteGasto = transacoes.find(item => item.apiIdempotencyHash === idempotencyHash);
            if (existenteGasto) return { tipo: 'expense', item: existenteGasto, duplicated: true };
            const existenteEntrada = entradas.find(item => item.apiIdempotencyHash === idempotencyHash);
            if (existenteEntrada) return { tipo: 'income', item: existenteEntrada, duplicated: true };
        }

        const criado = criarLancamentoApi(req.body || {}, dados, {
            now: new Date(),
            transactionId: randomUUID(),
            idempotencyHash,
            clientName: contexto.clientName,
            keyId: contexto.keyId
        });

        if (criado.tipo === 'expense') {
            transacoes.push(criado.item);
            transaction.update(usuarioRef, { 'dados.transacoes': transacoes });
        } else {
            entradas.push(criado.item);
            transaction.update(usuarioRef, { 'dados.entradas': entradas });
        }
        return { ...criado, duplicated: false };
    });

    if (!resultado.duplicated) {
        await registrarAuditoria(servicos, contexto, 'transaction.created', {
            transactionId: resultado.item.apiId,
            type: resultado.tipo
        });
    }
    return resultado;
}

async function removerTransacao(servicos, contexto, transactionId) {
    exigirEscopo(contexto, 'transactions:write');
    const usuarioRef = servicos.db.collection('usuarios').doc(contexto.uid);

    const removido = await servicos.db.runTransaction(async transaction => {
        const snap = await transaction.get(usuarioRef);
        if (!snap.exists) throw new ApiError(404, 'user_not_found', 'Conta do GugetFin não encontrada.');
        const dados = snap.data()?.dados || {};
        const transacoes = Array.isArray(dados.transacoes) ? [...dados.transacoes] : [];
        const entradas = Array.isArray(dados.entradas) ? [...dados.entradas] : [];
        const indiceGasto = transacoes.findIndex(item => String(item.apiId || item.id) === transactionId);
        const indiceEntrada = entradas.findIndex(item => String(item.apiId || item.id) === transactionId);

        if (indiceGasto >= 0) {
            if (transacoes[indiceGasto].origemApi !== true) throw new ApiError(403, 'not_api_transaction', 'Somente lançamentos criados pela API podem ser removidos por ela.');
            transacoes.splice(indiceGasto, 1);
            transaction.update(usuarioRef, { 'dados.transacoes': transacoes });
            return 'expense';
        }
        if (indiceEntrada >= 0) {
            if (entradas[indiceEntrada].origemApi !== true) throw new ApiError(403, 'not_api_transaction', 'Somente lançamentos criados pela API podem ser removidos por ela.');
            entradas.splice(indiceEntrada, 1);
            transaction.update(usuarioRef, { 'dados.entradas': entradas });
            return 'income';
        }
        throw new ApiError(404, 'transaction_not_found', 'Lançamento não encontrado.');
    });

    await registrarAuditoria(servicos, contexto, 'transaction.deleted', { transactionId, type: removido });
    return removido;
}

function listarTransacoes(dados, limite) {
    const gastos = (Array.isArray(dados.transacoes) ? dados.transacoes : []).map(item => ({
        tipo: 'expense',
        item,
        ordem: new Date(`${item.dataCompra || '1970-01-01'}T12:00:00Z`).getTime()
    }));
    const entradas = (Array.isArray(dados.entradas) ? dados.entradas : []).map(item => ({
        tipo: 'income',
        item,
        ordem: new Date(`${item.dataRecebimento || `${item.ano || 1970}-${String((item.mes || 0) + 1).padStart(2, '0')}-01`}T12:00:00Z`).getTime()
    }));
    return [...gastos, ...entradas]
        .sort((a, b) => b.ordem - a.ordem)
        .slice(0, limite)
        .map(registro => serializarLancamento(registro.tipo, registro.item));
}

function criarManipuladorApi(servicos) {
    return async function apiGugetFin(req, res) {
        const requestId = String(req.headers['x-cloud-trace-context'] || randomUUID()).split('/')[0];
        res.set('X-GugetFin-Api-Version', API_VERSION);

        try {
            if (configurarCors(req, res)) return;
            const path = caminho(req);
            const tamanhoCorpo = Number(req.headers['content-length'] || 0);
            if (tamanhoCorpo > 32768) {
                throw new ApiError(413, 'payload_too_large', 'O corpo da requisição deve ter no máximo 32 KB.');
            }

            if (req.method === 'GET' && (path === '/' || path === '/v1/health')) {
                return resposta(res, 200, {
                    success: true,
                    data: { service: 'GugetFin API', version: API_VERSION, status: 'ok' }
                }, requestId);
            }

            if (req.method === 'POST' && path === '/v1/oauth/token') {
                return endpointTokenAlexa(servicos, req, res);
            }

            const somenteFirebase = path.startsWith('/v1/integrations/keys') || path === '/v1/oauth/authorize';
            const contexto = await autenticar(req, servicos, somenteFirebase);

            if (req.method === 'POST' && path === '/v1/oauth/authorize') {
                const autorizacao = await autorizarAlexa(servicos, contexto, req.body || {});
                await registrarAuditoria(servicos, contexto, 'alexa.authorization.created', {});
                return resposta(res, 201, { success: true, data: autorizacao }, requestId);
            }

            if (req.method === 'GET' && path === '/v1/me') {
                exigirEscopo(contexto, 'profile:read');
                const usuario = await carregarUsuario(servicos.db, contexto.uid);
                const perfil = usuario.dados?.config?.perfil || {};
                return resposta(res, 200, { success: true, data: {
                    id: contexto.uid,
                    name: [perfil.nome, perfil.sobrenome].filter(Boolean).join(' ').trim(),
                    username: perfil.username || '',
                    email: perfil.email || ''
                } }, requestId);
            }

            if (req.method === 'GET' && path === '/v1/categories') {
                exigirEscopo(contexto, 'profile:read');
                const usuario = await carregarUsuario(servicos.db, contexto.uid);
                return resposta(res, 200, { success: true, data: {
                    expenses: obterCategorias(usuario.dados),
                    incomes: CATEGORIAS_ENTRADA
                } }, requestId);
            }

            if (req.method === 'GET' && path === '/v1/accounts') {
                exigirEscopo(contexto, 'profile:read');
                const usuario = await carregarUsuario(servicos.db, contexto.uid);
                const accounts = obterContas(usuario.dados).map(conta => ({
                    name: conta.nome,
                    debitOnly: conta.isDebitoOnly === true,
                    closingDay: Number(conta.fechamento || 0) || null,
                    dueDay: Number(conta.vencimento || 0) || null
                }));
                return resposta(res, 200, { success: true, data: accounts }, requestId);
            }

            if (req.method === 'GET' && path === '/v1/transactions') {
                exigirEscopo(contexto, 'transactions:read');
                const usuario = await carregarUsuario(servicos.db, contexto.uid);
                const limite = Math.max(1, Math.min(100, Number.parseInt(req.query?.limit, 10) || 25));
                return resposta(res, 200, { success: true, data: listarTransacoes(usuario.dados, limite) }, requestId);
            }

            if (req.method === 'POST' && path === '/v1/transactions') {
                const criado = await criarTransacao(servicos, contexto, req);
                return resposta(res, criado.duplicated ? 200 : 201, {
                    success: true,
                    duplicated: criado.duplicated,
                    data: serializarLancamento(criado.tipo, criado.item)
                }, requestId);
            }

            const deleteMatch = path.match(/^\/v1\/transactions\/([^/]+)$/);
            if (req.method === 'DELETE' && deleteMatch) {
                const transactionId = decodeURIComponent(deleteMatch[1]);
                await removerTransacao(servicos, contexto, transactionId);
                return resposta(res, 200, { success: true, data: { id: transactionId, deleted: true } }, requestId);
            }

            if (req.method === 'GET' && path === '/v1/integrations/keys') {
                return resposta(res, 200, { success: true, data: await listarChaves(servicos, contexto) }, requestId);
            }

            if (req.method === 'POST' && path === '/v1/integrations/keys') {
                const chave = await criarChave(servicos, contexto, req.body || {});
                await registrarAuditoria(servicos, contexto, 'integration.created', { keyId: chave.id, name: chave.name });
                return resposta(res, 201, { success: true, data: chave }, requestId);
            }

            const keyMatch = path.match(/^\/v1\/integrations\/keys\/([^/]+)$/);
            if (req.method === 'DELETE' && keyMatch) {
                const keyId = decodeURIComponent(keyMatch[1]);
                await revogarChave(servicos, contexto, keyId);
                await registrarAuditoria(servicos, contexto, 'integration.revoked', { keyId });
                return resposta(res, 200, { success: true, data: { id: keyId, revoked: true } }, requestId);
            }

            throw new ApiError(404, 'route_not_found', 'Rota não encontrada.');
        } catch (error) {
            erro(res, error, requestId, servicos.logger);
        }
    };
}

module.exports = { criarManipuladorApi };
