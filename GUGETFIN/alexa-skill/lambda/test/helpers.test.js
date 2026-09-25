const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../index');

test('normaliza as formas de pagamento faladas', () => {
    assert.equal(_test.formaPagamento('cartão de crédito'), 'credit');
    assert.equal(_test.formaPagamento('Pix'), 'pix');
    assert.equal(_test.formaPagamento('dinheiro'), 'cash');
    assert.equal(_test.formaPagamento('débito'), 'debit');
});

test('remove respostas que significam sem descrição', () => {
    assert.equal(_test.descricao('sem descrição'), '');
    assert.equal(_test.descricao('não'), '');
    assert.equal(_test.descricao('compra do aniversário'), 'compra do aniversário');
});

test('aceita datas completas e valores decimais', () => {
    assert.equal(_test.dataValida('2026-09-24'), true);
    assert.equal(_test.dataValida('2026-W39'), false);
    assert.equal(_test.valorNumero('125,50'), 125.5);
});

test('converte categorias de entrada para o formato do GugetFin', () => {
    assert.equal(_test.categoriaEntrada('projetos e serviços'), 'Projetos / Serviços');
    assert.equal(_test.categoriaEntrada('contrato'), 'Fixo / Contrato');
    assert.equal(_test.categoriaEntrada('renda extra'), 'Renda Extra');
});
