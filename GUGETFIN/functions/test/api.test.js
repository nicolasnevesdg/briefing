const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { criarManipuladorApi } = require('../src/api');

function respostaMock() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        ended: false,
        set(nome, valor) {
            this.headers[nome] = valor;
            return this;
        },
        status(valor) {
            this.statusCode = valor;
            return this;
        },
        json(valor) {
            this.body = valor;
            return this;
        },
        end() {
            this.ended = true;
            return this;
        },
        send(valor) {
            this.body = valor;
            this.ended = true;
            return this;
        }
    };
}

const servicos = {
    db: {},
    auth: {},
    logger: { error() {}, warn() {}, info() {} },
    getWhatsAppVerifyToken: () => 'segredo-de-teste',
    getWhatsAppAppSecret: () => 'app-secret-de-teste'
};

test('health responde sem autenticação', async () => {
    const handler = criarManipuladorApi(servicos);
    const req = { method: 'GET', path: '/v1/health', headers: {}, query: {} };
    const res = respostaMock();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'ok');
    assert.equal(res.headers['X-GugetFin-Api-Version'], '1.3.0');
});

test('Meta consegue validar o webhook do WhatsApp', async () => {
    const handler = criarManipuladorApi(servicos);
    const req = {
        method: 'GET',
        path: '/v1/whatsapp/webhook',
        headers: {},
        query: {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'segredo-de-teste',
            'hub.challenge': '123456'
        }
    };
    const res = respostaMock();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body, '123456');
});

test('webhook do WhatsApp rejeita token de verificação incorreto', async () => {
    const handler = criarManipuladorApi(servicos);
    const req = {
        method: 'GET',
        path: '/v1/whatsapp/webhook',
        headers: {},
        query: {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'token-errado',
            'hub.challenge': '123456'
        }
    };
    const res = respostaMock();

    await handler(req, res);

    assert.equal(res.statusCode, 403);
});

test('webhook do WhatsApp confirma o recebimento sem exigir login', async () => {
    const handler = criarManipuladorApi(servicos);
    const body = { object: 'whatsapp_business_account', entry: [] };
    const rawBody = Buffer.from(JSON.stringify(body));
    const req = {
        method: 'POST',
        path: '/v1/whatsapp/webhook',
        headers: {
            'x-hub-signature-256': `sha256=${createHmac('sha256', 'app-secret-de-teste').update(rawBody).digest('hex')}`
        },
        query: {},
        body,
        rawBody
    };
    const res = respostaMock();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body, 'EVENT_RECEIVED');
});

test('webhook do WhatsApp rejeita uma assinatura inválida', async () => {
    const handler = criarManipuladorApi(servicos);
    const req = {
        method: 'POST',
        path: '/v1/whatsapp/webhook',
        headers: { 'x-hub-signature-256': 'sha256=incorreta' },
        query: {},
        body: { object: 'whatsapp_business_account', entry: [] }
    };
    const res = respostaMock();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
});

test('rota protegida exige token Bearer', async () => {
    const handler = criarManipuladorApi(servicos);
    const req = { method: 'GET', path: '/v1/accounts', headers: {}, query: {} };
    const res = respostaMock();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, 'missing_token');
});

test('rejeita corpo maior que 32 KB', async () => {
    const handler = criarManipuladorApi(servicos);
    const req = {
        method: 'POST',
        path: '/v1/transactions',
        headers: { 'content-length': '40000' },
        query: {},
        body: {}
    };
    const res = respostaMock();

    await handler(req, res);

    assert.equal(res.statusCode, 413);
    assert.equal(res.body.error.code, 'payload_too_large');
});
