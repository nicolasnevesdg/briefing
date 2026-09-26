const { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { ApiError, criarLancamentoApi, texto } = require('./domain');
const { avancarConversa, inicio } = require('./whatsapp-conversation');

const CAMINHO_WEBHOOK = '/v1/whatsapp/webhook';
const COLECAO_LINKS = '_gugetWhatsappLinks';
const COLECAO_TOKENS = '_gugetWhatsappLinkTokens';
const COLECAO_SESSOES = '_gugetWhatsappSessions';
const COLECAO_MENSAGENS = '_gugetWhatsappMessages';
const LINK_TTL_MS = 15 * 60 * 1000;
const GRAPH_VERSION = 'v26.0';

function hash(valor) {
    return createHash('sha256').update(String(valor)).digest('hex');
}

function mesmoSegredo(recebido, esperado) {
    const a = Buffer.from(String(recebido || ''), 'utf8');
    const b = Buffer.from(String(esperado || ''), 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
}

function segredo(servicos, nome) {
    const getter = servicos[nome];
    return typeof getter === 'function' ? String(getter() || '').trim() : '';
}

function verificarWebhook(servicos, req, res) {
    const modo = String(req.query?.['hub.mode'] || '');
    const token = String(req.query?.['hub.verify_token'] || '');
    const desafio = String(req.query?.['hub.challenge'] || '');
    const esperado = segredo(servicos, 'getWhatsAppVerifyToken');

    if (modo === 'subscribe' && desafio && esperado && mesmoSegredo(token, esperado)) {
        res.status(200).send(desafio);
        return;
    }
    res.status(403).send('Verificação recusada.');
}

function assinaturaValida(req, appSecret) {
    if (!appSecret) return false;
    const recebida = String(req.headers?.['x-hub-signature-256'] || '');
    if (!recebida.startsWith('sha256=')) return false;
    const corpo = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
    const esperada = `sha256=${createHmac('sha256', appSecret).update(corpo).digest('hex')}`;
    return mesmoSegredo(recebida, esperada);
}

function extrairMensagens(body) {
    if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return [];
    const mensagens = [];
    for (const entrada of body.entry) {
        for (const alteracao of Array.isArray(entrada?.changes) ? entrada.changes : []) {
            if (alteracao?.field !== 'messages') continue;
            const value = alteracao.value || {};
            for (const mensagem of Array.isArray(value.messages) ? value.messages : []) {
                mensagens.push({
                    id: texto(mensagem?.id, 180),
                    from: texto(mensagem?.from, 40),
                    type: texto(mensagem?.type, 30),
                    text: texto(mensagem?.text?.body, 1000),
                    phoneNumberId: texto(value?.metadata?.phone_number_id, 40)
                });
            }
        }
    }
    return mensagens.filter(item => item.id && item.from);
}

async function enviarTexto(servicos, destino, mensagem, phoneNumberId) {
    const accessToken = segredo(servicos, 'getWhatsAppAccessToken');
    const esperado = texto(servicos.whatsAppPhoneNumberId, 40);
    if (!accessToken) throw new Error('Token de acesso do WhatsApp não configurado.');
    if (!phoneNumberId || (esperado && phoneNumberId !== esperado)) throw new Error('Número de telefone do webhook não autorizado.');

    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: destino,
            type: 'text',
            text: { preview_url: false, body: texto(mensagem, 4096) }
        })
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(`WhatsApp recusou a mensagem (${payload?.error?.code || response.status}).`);
    }
}

async function reservarMensagem(servicos, messageId) {
    const ref = servicos.db.collection(COLECAO_MENSAGENS).doc(hash(messageId));
    try {
        await ref.create({ messageIdHash: hash(messageId), createdAt: FieldValue.serverTimestamp() });
        return true;
    } catch (error) {
        if (Number(error?.code) === 6 || String(error?.code) === 'already-exists') return false;
        throw error;
    }
}

async function linkPara(servicos, waId) {
    const token = randomBytes(32).toString('base64url');
    await servicos.db.collection(COLECAO_TOKENS).doc(hash(token)).set({
        waIdHash: hash(waId),
        waId,
        expiresAtMs: Date.now() + LINK_TTL_MS,
        usedAt: null,
        createdAt: FieldValue.serverTimestamp()
    });
    const origem = String(servicos.publicSiteUrl || 'https://nicolasneves.com.br').replace(/\/$/, '');
    return `${origem}/whatsapp-link.html?token=${encodeURIComponent(token)}`;
}

async function cadastrarLancamento(servicos, uid, body, messageId) {
    const usuarioRef = servicos.db.collection('usuarios').doc(uid);
    return servicos.db.runTransaction(async transaction => {
        const snap = await transaction.get(usuarioRef);
        if (!snap.exists) throw new Error('Conta vinculada não encontrada.');
        const dados = snap.data()?.dados || {};
        const idempotencyHash = hash(`whatsapp:${messageId}`);
        const transacoes = Array.isArray(dados.transacoes) ? [...dados.transacoes] : [];
        const entradas = Array.isArray(dados.entradas) ? [...dados.entradas] : [];
        const existente = [...transacoes, ...entradas].find(item => item.apiIdempotencyHash === idempotencyHash);
        if (existente) return existente;

        const criado = criarLancamentoApi(body, dados, {
            now: new Date(), transactionId: randomUUID(), idempotencyHash,
            clientName: 'WhatsApp GugetFin', keyId: 'whatsapp'
        });
        if (criado.tipo === 'expense') {
            transacoes.push(criado.item);
            transaction.update(usuarioRef, { 'dados.transacoes': transacoes });
        } else {
            entradas.push(criado.item);
            transaction.update(usuarioRef, { 'dados.entradas': entradas });
        }
        return criado.item;
    });
}

async function processarMensagem(servicos, mensagem) {
    if (!(await reservarMensagem(servicos, mensagem.id))) return;
    if (mensagem.type !== 'text' || !mensagem.text) {
        await enviarTexto(servicos, mensagem.from, 'Por enquanto, envie sua resposta em texto.', mensagem.phoneNumberId);
        return;
    }

    const waIdHash = hash(mensagem.from);
    const linkSnap = await servicos.db.collection(COLECAO_LINKS).doc(waIdHash).get();
    if (!linkSnap.exists || !linkSnap.data()?.uid) {
        const url = await linkPara(servicos, mensagem.from);
        await enviarTexto(servicos, mensagem.from, `Para usar o GugetFin por aqui, conecte sua conta neste link seguro (válido por 15 minutos):\n${url}`, mensagem.phoneNumberId);
        return;
    }

    const uid = linkSnap.data().uid;
    const usuarioSnap = await servicos.db.collection('usuarios').doc(uid).get();
    if (!usuarioSnap.exists) {
        await enviarTexto(servicos, mensagem.from, 'A conta vinculada não existe mais. Envie outra mensagem para criar uma nova conexão.', mensagem.phoneNumberId);
        return;
    }
    const dados = usuarioSnap.data()?.dados || {};
    const sessaoRef = servicos.db.collection(COLECAO_SESSOES).doc(waIdHash);
    const sessaoSnap = await sessaoRef.get();
    const resultado = avancarConversa(sessaoSnap.exists ? sessaoSnap.data()?.state : null, mensagem.text, dados, new Date());

    if (resultado.lancamento) {
        await cadastrarLancamento(servicos, uid, resultado.lancamento, mensagem.id);
        await sessaoRef.delete();
        await enviarTexto(servicos, mensagem.from, `Pronto! O lançamento foi cadastrado no GugetFin.\n\n${inicio()}`, mensagem.phoneNumberId);
        return;
    }
    if (resultado.sessao) {
        await sessaoRef.set({ state: resultado.sessao, uid, updatedAt: FieldValue.serverTimestamp() });
    } else {
        await sessaoRef.delete().catch(() => null);
    }
    await enviarTexto(servicos, mensagem.from, resultado.resposta, mensagem.phoneNumberId);
}

async function receberWebhook(servicos, req, res) {
    if (!assinaturaValida(req, segredo(servicos, 'getWhatsAppAppSecret'))) {
        res.status(401).send('Assinatura inválida.');
        return;
    }
    const mensagens = extrairMensagens(req.body);
    for (const mensagem of mensagens) {
        try {
            await processarMensagem(servicos, mensagem);
        } catch (error) {
            servicos.logger.error('Falha ao processar mensagem do WhatsApp', {
                messageIdHash: hash(mensagem.id), error: error?.message || 'unknown_error'
            });
        }
    }
    res.status(200).send('EVENT_RECEIVED');
}

async function autorizarWhatsApp(servicos, contexto, body) {
    const token = texto(body?.token, 200);
    if (token.length < 32) throw new ApiError(400, 'invalid_link_token', 'O pedido de conexão não é válido.');
    const tokenRef = servicos.db.collection(COLECAO_TOKENS).doc(hash(token));

    return servicos.db.runTransaction(async transaction => {
        const tokenSnap = await transaction.get(tokenRef);
        const dadosToken = tokenSnap.data();
        if (!tokenSnap.exists || dadosToken?.usedAt || Number(dadosToken?.expiresAtMs || 0) <= Date.now()) {
            throw new ApiError(410, 'expired_link_token', 'Este link expirou. Envie uma nova mensagem para o GugetFin no WhatsApp.');
        }
        const linkRef = servicos.db.collection(COLECAO_LINKS).doc(dadosToken.waIdHash);
        const integracaoRef = servicos.db.collection('usuarios').doc(contexto.uid).collection('integracoesWhatsapp').doc('principal');
        transaction.set(linkRef, { uid: contexto.uid, waId: dadosToken.waId, linkedAt: FieldValue.serverTimestamp() });
        transaction.set(integracaoRef, { waIdHash: dadosToken.waIdHash, linkedAt: FieldValue.serverTimestamp() });
        transaction.update(tokenRef, { usedAt: FieldValue.serverTimestamp(), uid: contexto.uid });
        return { linked: true };
    });
}

module.exports = {
    CAMINHO_WEBHOOK,
    assinaturaValida,
    autorizarWhatsApp,
    extrairMensagens,
    receberWebhook,
    verificarWebhook
};
