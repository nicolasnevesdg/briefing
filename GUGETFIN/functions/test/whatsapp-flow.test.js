const test = require('node:test');
const assert = require('node:assert/strict');
const {
    montarPayloadFlow,
    normalizarRespostaFlow,
    tipoSolicitado
} = require('../src/whatsapp-flow');

const dados = {
    config: {
        categorias: ['Alimentação', 'Transporte'],
        detalhesBancos: [{ nome: 'Nubank' }, { nome: 'Inter' }]
    }
};

test('reconhece entrada e saída como início de Flow', () => {
    assert.equal(tipoSolicitado('type:expense'), 'expense');
    assert.equal(tipoSolicitado('Saída'), 'expense');
    assert.equal(tipoSolicitado('entrada'), 'income');
    assert.equal(tipoSolicitado('qualquer coisa'), '');
});

test('monta Flow de saída com cartões e categorias da conta', () => {
    const resultado = montarPayloadFlow(
        '5521999999999',
        'flow-123',
        'token-123',
        'expense',
        dados,
        'draft'
    );
    const parametros = resultado.payload.interactive.action.parameters;

    assert.equal(resultado.payload.interactive.type, 'flow');
    assert.equal(parametros.flow_id, 'flow-123');
    assert.equal(parametros.flow_mode, 'draft');
    assert.equal(parametros.flow_action_payload.screen, 'EXPENSE_FORM');
    assert.deepEqual(parametros.flow_action_payload.data.accounts, [
        { id: 'account:0', title: 'Nubank' },
        { id: 'account:1', title: 'Inter' }
    ]);
    assert.deepEqual(parametros.flow_action_payload.data.categories, [
        { id: 'category:0', title: 'Alimentação' },
        { id: 'category:1', title: 'Transporte' }
    ]);
});

test('transforma resposta do Flow em lançamento validado', () => {
    const lancamento = normalizarRespostaFlow({
        type: 'expense',
        name: 'Mercado',
        amount: '125,50',
        date: '2026-10-10',
        payment_method: 'credit',
        account: 'account:1',
        installments: '2',
        category: 'category:0',
        description: 'Compra do mês'
    }, {
        tipo: 'expense',
        contas: ['Nubank', 'Inter'],
        categorias: ['Alimentação', 'Transporte']
    });

    assert.deepEqual(lancamento, {
        type: 'expense',
        name: 'Mercado',
        amount: 125.5,
        date: '2026-10-10',
        category: 'Alimentação',
        description: 'Compra do mês',
        paymentMethod: 'credit',
        account: 'Inter',
        installments: 2
    });
});

test('não aceita opção forjada fora das listas emitidas', () => {
    assert.throws(() => normalizarRespostaFlow({
        type: 'income',
        name: 'Salário',
        amount: '2500',
        date: '2026-10-10',
        category: 'category:99'
    }, {
        tipo: 'income',
        contas: [],
        categorias: ['Salário']
    }), /não é mais válida/);
});
