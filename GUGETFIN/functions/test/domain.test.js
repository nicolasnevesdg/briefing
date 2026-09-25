const test = require('node:test');
const assert = require('node:assert/strict');
const { criarLancamentoApi, dataIso } = require('../src/domain');

const dados = {
    config: {
        categorias: ['Alimentação', 'Transporte', 'Mercado'],
        detalhesBancos: [
            { nome: 'Nubank', fechamento: 8, vencimento: 15 },
            { nome: 'Inter', isDebitoOnly: true }
        ]
    }
};

const contexto = {
    now: new Date('2026-09-20T15:00:00Z'),
    transactionId: 'api-123',
    clientName: 'Relógio teste',
    keyId: 'key-1',
    idempotencyHash: 'idem-1'
};

test('cria gasto no crédito compatível com o formato atual', () => {
    const resultado = criarLancamentoApi({
        type: 'expense',
        name: 'Mercado',
        amount: '125,50',
        date: '2026-09-19',
        paymentMethod: 'credit',
        account: 'nubank',
        category: 'mercado',
        installments: 2,
        description: 'Compra da semana'
    }, dados, contexto);

    assert.equal(resultado.tipo, 'expense');
    assert.equal(resultado.item.tipo, 'cartao');
    assert.equal(resultado.item.valorTotal, 125.5);
    assert.equal(resultado.item.valorParcela, 62.75);
    assert.equal(resultado.item.banco, 'Nubank');
    assert.equal(resultado.item.categoria, 'Mercado');
    assert.equal(resultado.item.origemApi, true);
});

test('cria gasto Pix como débito', () => {
    const resultado = criarLancamentoApi({
        type: 'expense',
        name: 'Uber',
        amount: 32,
        paymentMethod: 'pix',
        account: 'Inter',
        category: 'Transporte'
    }, dados, contexto);

    assert.equal(resultado.item.tipo, 'debito');
    assert.equal(resultado.item.formaPagamento, 'Pix');
    assert.equal(resultado.item.parcelas, 1);
});

test('aceita valor monetário no formato brasileiro', () => {
    const resultado = criarLancamentoApi({
        type: 'expense',
        name: 'Notebook',
        amount: 'R$ 1.234,56',
        paymentMethod: 'credit',
        account: 'Nubank',
        category: 'Mercado'
    }, dados, contexto);

    assert.equal(resultado.item.valorTotal, 1234.56);
});

test('cria entrada simples no mês correto', () => {
    const resultado = criarLancamentoApi({
        type: 'income',
        name: 'Freelance',
        amount: 500,
        date: '2026-08-31',
        category: 'Renda Extra',
        source: 'Cliente X'
    }, dados, contexto);

    assert.equal(resultado.tipo, 'income');
    assert.equal(resultado.item.valor, 500);
    assert.equal(resultado.item.mes, 7);
    assert.equal(resultado.item.ano, 2026);
    assert.equal(resultado.item.cliente, 'Cliente X');
});

test('rejeita categoria que não pertence ao usuário', () => {
    assert.throws(() => criarLancamentoApi({
        type: 'expense',
        name: 'Teste',
        amount: 10,
        paymentMethod: 'cash',
        category: 'Categoria inventada'
    }, dados, contexto), error => error.code === 'unknown_category' && error.status === 422);
});

test('rejeita data inexistente', () => {
    assert.throws(() => dataIso('2026-02-30'), error => error.code === 'invalid_date');
});
