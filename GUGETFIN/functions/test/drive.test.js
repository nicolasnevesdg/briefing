const test = require('node:test');
const assert = require('node:assert/strict');
const {
    criptografarToken,
    descriptografarToken,
    iniciarOAuthDrive,
    nomeBackup
} = require('../src/drive');

const chave = Buffer.alloc(32, 7).toString('base64');

test('protege o refresh token antes de persistir', () => {
    const servicos = { getGoogleDriveEncryptionKey: () => chave };
    const protegido = criptografarToken(servicos, 'refresh-token-secreto');

    assert.notEqual(protegido, 'refresh-token-secreto');
    assert.match(protegido, /^v1\./);
    assert.equal(descriptografarToken(servicos, protegido), 'refresh-token-secreto');
});

test('gera nome de backup previsível', () => {
    assert.equal(
        nomeBackup(new Date('2026-09-26T13:07:00.000Z')),
        'GugetFin_Backup_2026-09-26_13h07.js'
    );
});

test('inicia autorização permanente e limita a origem de retorno', async () => {
    let estadoSalvo;
    const servicos = {
        db: {
            collection() {
                return {
                    doc() {
                        return { async set(valor) { estadoSalvo = valor; } };
                    }
                };
            }
        },
        publicSiteUrl: 'https://nicolasneves.com.br/GUGETFIN',
        googleDriveClientId: 'cliente.apps.googleusercontent.com',
        googleDriveRedirectUri: 'https://api.exemplo.com/v1/drive/oauth/callback'
    };

    const resultado = await iniciarOAuthDrive(servicos, { uid: 'usuario-1' }, { origin: 'https://site-malicioso.example' });
    const url = new URL(resultado.authorizationUrl);

    assert.equal(estadoSalvo.uid, 'usuario-1');
    assert.equal(estadoSalvo.origin, 'https://nicolasneves.com.br');
    assert.equal(url.searchParams.get('access_type'), 'offline');
    assert.equal(url.searchParams.get('prompt'), 'consent');
    assert.match(url.searchParams.get('scope'), /drive\.file/);
    assert.ok(url.searchParams.get('state'));
});
