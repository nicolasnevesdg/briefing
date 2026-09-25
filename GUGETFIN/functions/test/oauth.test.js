const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const {
    extrairCredenciaisCliente,
    validarPkce,
    validarRedirectAlexa
} = require('../src/oauth');

test('aceita somente endereços oficiais de retorno da Alexa', () => {
    assert.equal(validarRedirectAlexa('https://pitangui.amazon.com/api/skill/link/M123ABC'), true);
    assert.equal(validarRedirectAlexa('https://layla.amazon.com/api/skill/link/M123ABC'), true);
    assert.equal(validarRedirectAlexa('https://exemplo.com/api/skill/link/M123ABC'), false);
    assert.equal(validarRedirectAlexa('http://pitangui.amazon.com/api/skill/link/M123ABC'), false);
});

test('valida PKCE S256', () => {
    const verifier = 'gugetfin-alexa-verifier-seguro-com-mais-de-43-caracteres-2026';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    assert.equal(validarPkce(verifier, challenge, 'S256'), true);
    assert.equal(validarPkce(`${verifier}x`, challenge, 'S256'), false);
    assert.equal(validarPkce(verifier, challenge, 'plain'), false);
});

test('lê credenciais OAuth em HTTP Basic', () => {
    const valor = Buffer.from('gugetfin-alexa:segredo-teste').toString('base64');
    const credenciais = extrairCredenciaisCliente({
        headers: { authorization: `Basic ${valor}` },
        body: {}
    });
    assert.deepEqual(credenciais, {
        clientId: 'gugetfin-alexa',
        clientSecret: 'segredo-teste'
    });
});
