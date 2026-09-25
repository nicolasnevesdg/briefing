const test = require('node:test');
const assert = require('node:assert/strict');
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
        }
    };
}

const servicos = {
    db: {},
    auth: {},
    logger: { error() {}, warn() {} }
};

test('health responde sem autenticação', async () => {
    const handler = criarManipuladorApi(servicos);
    const req = { method: 'GET', path: '/v1/health', headers: {}, query: {} };
    const res = respostaMock();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'ok');
    assert.equal(res.headers['X-GugetFin-Api-Version'], '1.1.0');
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
