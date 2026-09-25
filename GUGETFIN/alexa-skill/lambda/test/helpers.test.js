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
    assert.equal(_test.valorNumero('1 real'), 1);
    assert.equal(_test.valorNumero('2 reais'), 2);
    assert.equal(_test.valorNumero('12 reais e 50 centavos'), 12.5);
});

test('converte categorias de entrada para o formato do GugetFin', () => {
    assert.equal(_test.categoriaEntrada('projetos e serviços'), 'Projetos / Serviços');
    assert.equal(_test.categoriaEntrada('contrato'), 'Fixo / Contrato');
    assert.equal(_test.categoriaEntrada('renda extra'), 'Renda Extra');
});

test('monta listas naturais para a Alexa falar', () => {
    assert.equal(_test.listaFalavel(['Nubank']), 'Nubank');
    assert.equal(_test.listaFalavel(['Nubank', 'Inter']), 'Nubank e Inter');
    assert.equal(_test.listaFalavel(['Nubank', 'Inter', 'Itaú']), 'Nubank, Inter e Itaú');
    assert.equal(_test.listaFalavel(['Banco A&B', 'Inter']), 'Banco A&amp;B e Inter');
});

test('encontra o próximo campo ainda não respondido', () => {
    const intent = {
        slots: {
            nome: { name: 'nome', value: 'mercado' },
            valor: { name: 'valor' }
        }
    };
    assert.equal(_test.primeiroSlotAusente(intent, ['nome', 'valor', 'data']), 'valor');
});

test('usa o valor canônico resolvido pelas entidades dinâmicas', () => {
    const intent = {
        slots: {
            conta: {
                name: 'conta',
                value: 'nu bank',
                resolutions: {
                    resolutionsPerAuthority: [{
                        status: { code: 'ER_SUCCESS_MATCH' },
                        values: [{ value: { name: 'Nubank' } }]
                    }]
                }
            }
        }
    };
    assert.equal(_test.slot(intent, 'conta'), 'Nubank');
});
