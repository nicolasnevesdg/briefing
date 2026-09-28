const test = require('node:test');
const assert = require('node:assert/strict');
const {
    desconectarWhatsApp,
    extrairMensagens,
    montarPayloadWhatsApp,
    obterStatusWhatsApp
} = require('../src/whatsapp');

test('extrai clique em botão interativo do webhook da Meta', () => {
    const mensagens = extrairMensagens({
        object: 'whatsapp_business_account',
        entry: [{
            changes: [{
                field: 'messages',
                value: {
                    metadata: { phone_number_id: '123' },
                    messages: [{
                        id: 'wamid.1',
                        from: '5521999999999',
                        type: 'interactive',
                        interactive: {
                            type: 'button_reply',
                            button_reply: { id: 'type:expense', title: 'Saída' }
                        }
                    }]
                }
            }]
        }]
    });

    assert.equal(mensagens.length, 1);
    assert.equal(mensagens[0].type, 'interactive');
    assert.equal(mensagens[0].text, 'type:expense');
    assert.equal(mensagens[0].choiceTitle, 'Saída');
});

test('extrai seleção de lista interativa do webhook da Meta', () => {
    const mensagens = extrairMensagens({
        object: 'whatsapp_business_account',
        entry: [{
            changes: [{
                field: 'messages',
                value: {
                    metadata: { phone_number_id: '123' },
                    messages: [{
                        id: 'wamid.2', from: '5521999999999', type: 'interactive',
                        interactive: { type: 'list_reply', list_reply: { id: 'category:2', title: 'Mercado' } }
                    }]
                }
            }]
        }]
    });

    assert.equal(mensagens[0].text, 'category:2');
    assert.equal(mensagens[0].choiceTitle, 'Mercado');
});

test('monta payload oficial de botões do WhatsApp', () => {
    const payload = montarPayloadWhatsApp('5521999999999', 'Escolha', {
        type: 'buttons',
        body: 'Entrada ou saída?',
        buttons: [
            { id: 'type:income', title: 'Entrada' },
            { id: 'type:expense', title: 'Saída' }
        ]
    });

    assert.equal(payload.type, 'interactive');
    assert.equal(payload.interactive.type, 'button');
    assert.equal(payload.interactive.action.buttons[1].reply.id, 'type:expense');
});

test('monta payload oficial de lista do WhatsApp', () => {
    const payload = montarPayloadWhatsApp('5521999999999', 'Escolha', {
        type: 'list',
        body: 'Qual conta?',
        button: 'Ver opções',
        sectionTitle: 'Contas',
        rows: [{ id: 'account:0', title: 'Nubank' }]
    });

    assert.equal(payload.type, 'interactive');
    assert.equal(payload.interactive.type, 'list');
    assert.equal(payload.interactive.action.sections[0].rows[0].id, 'account:0');
});

function firestoreWhatsAppFake({ conectado = true } = {}) {
    const referencias = new Map();
    const excluidas = [];
    const linkedAt = new Date('2026-09-26T18:30:00.000Z');

    function referencia(path) {
        if (referencias.has(path)) return referencias.get(path);
        const ref = {
            path,
            doc(id) { return referencia(`${path}/${id}`); },
            collection(nome) { return referencia(`${path}/${nome}`); },
            async get() {
                if (path === 'usuarios/usuario-1/integracoesWhatsapp/principal') {
                    return conectado
                        ? { exists: true, data: () => ({ waIdHash: 'hash-numero', linkedAt }) }
                        : { exists: false, data: () => undefined };
                }
                if (path === '_gugetWhatsappLinks/hash-numero') {
                    return conectado
                        ? { exists: true, data: () => ({ uid: 'usuario-1', waId: '5521998765432', linkedAt }) }
                        : { exists: false, data: () => undefined };
                }
                return { exists: false, data: () => undefined };
            }
        };
        referencias.set(path, ref);
        return ref;
    }

    return {
        excluidas,
        db: {
            collection(nome) { return referencia(nome); },
            batch() {
                return {
                    delete(ref) { excluidas.push(ref.path); },
                    async commit() {}
                };
            }
        }
    };
}

test('mostra WhatsApp conectado sem expor o número completo', async () => {
    const fake = firestoreWhatsAppFake();
    const status = await obterStatusWhatsApp({ db: fake.db }, { uid: 'usuario-1' });

    assert.equal(status.connected, true);
    assert.equal(status.phone, '•••• 5432');
    assert.equal(status.linkedAt, '2026-09-26T18:30:00.000Z');
});

test('revoga vínculo e conversa ativa do WhatsApp', async () => {
    const fake = firestoreWhatsAppFake();
    const resultado = await desconectarWhatsApp({ db: fake.db }, { uid: 'usuario-1' });

    assert.equal(resultado.disconnected, true);
    assert.deepEqual(fake.excluidas.sort(), [
        '_gugetWhatsappLinks/hash-numero',
        '_gugetWhatsappSessions/hash-numero',
        'usuarios/usuario-1/integracoesWhatsapp/principal'
    ].sort());
});
