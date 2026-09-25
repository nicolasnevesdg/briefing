const test = require('node:test');
const assert = require('node:assert/strict');

const axiosPath = require.resolve('axios');
require.cache[axiosPath] = {
    id: axiosPath,
    filename: axiosPath,
    loaded: true,
    exports: async ({ url }) => {
        if (url === '/accounts') {
            return { data: { data: [{ name: 'Nubank' }, { name: 'Banco A&B' }] } };
        }
        if (url === '/categories') {
            return { data: { data: { expenses: ['Alimentação', 'Transporte'] } } };
        }
        throw new Error(`Rota inesperada no teste: ${url}`);
    }
};

const { handler } = require('../index');

function eventoSaida(slots, sessionAttributes = {}) {
    const nomes = ['nome', 'valor', 'data', 'formaPagamento', 'parcelas', 'conta', 'categoria', 'descricao'];
    const intentSlots = Object.fromEntries(nomes.map(nome => [nome, {
        name: nome,
        confirmationStatus: 'NONE',
        ...(slots[nome] ? { value: slots[nome] } : {})
    }]));
    return {
        version: '1.0',
        session: {
            new: false,
            sessionId: 'teste',
            attributes: sessionAttributes,
            application: { applicationId: 'teste' },
            user: { accessToken: 'token-de-teste' }
        },
        context: {
            System: {
                application: { applicationId: 'teste' },
                user: { accessToken: 'token-de-teste' },
                device: { deviceId: 'teste', supportedInterfaces: {} },
                apiEndpoint: 'https://api.amazonalexa.com',
                apiAccessToken: 'token-alexa-de-teste'
            }
        },
        request: {
            type: 'IntentRequest',
            requestId: 'teste',
            timestamp: '2026-09-25T00:00:00Z',
            locale: 'pt-BR',
            dialogState: 'IN_PROGRESS',
            intent: {
                name: 'CadastrarSaidaIntent',
                confirmationStatus: 'NONE',
                slots: intentSlots
            }
        }
    };
}

function executar(evento) {
    return new Promise((resolve, reject) => {
        handler(evento, {}, (erro, resposta) => erro ? reject(erro) : resolve(resposta));
    });
}

test('anuncia as contas cadastradas ao solicitar o cartão', async () => {
    const resposta = await executar(eventoSaida({
        nome: 'teste',
        valor: '2',
        data: '2026-09-25',
        formaPagamento: 'débito',
        parcelas: '1'
    }));

    assert.match(resposta.response.outputSpeech.ssml, /Nubank e Banco A&amp;B/);
    assert.deepEqual(resposta.response.directives, [{
        type: 'Dialog.ElicitSlot',
        slotToElicit: 'conta',
        updatedIntent: resposta.response.directives[0].updatedIntent
    }]);
});

test('anuncia as categorias depois da escolha da conta', async () => {
    const resposta = await executar(eventoSaida({
        nome: 'teste',
        valor: '2',
        data: '2026-09-25',
        formaPagamento: 'débito',
        parcelas: '1',
        conta: 'Nubank'
    }, {
        gugetfinContas: [{ name: 'Nubank' }, { name: 'Inter' }],
        gugetfinCategorias: ['Alimentação', 'Transporte']
    }));

    assert.match(resposta.response.outputSpeech.ssml, /Alimentação e Transporte/);
    assert.equal(resposta.response.directives[0].type, 'Dialog.ElicitSlot');
    assert.equal(resposta.response.directives[0].slotToElicit, 'categoria');
});
