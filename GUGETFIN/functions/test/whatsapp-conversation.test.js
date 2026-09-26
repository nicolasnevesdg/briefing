const test = require('node:test');
const assert = require('node:assert/strict');
const {
    avancarConversa,
    interpretarData,
    interpretarValor,
    resolverResposta
} = require('../src/whatsapp-conversation');

const dados = {
    config: {
        categorias: ['Alimentação', 'Transporte'],
        detalhesBancos: [{ nome: 'Nubank' }, { nome: 'Itaú' }]
    }
};

test('entende valores brasileiros e a palavra reais', () => {
    assert.equal(interpretarValor('R$ 1.234,56'), 1234.56);
    assert.equal(interpretarValor('2 reais'), 2);
    assert.equal(interpretarValor('zero'), null);
});

test('entende datas comuns no WhatsApp', () => {
    const agora = new Date('2026-09-26T15:00:00Z');
    assert.equal(interpretarData('hoje', agora), '2026-09-26');
    assert.equal(interpretarData('ontem', agora), '2026-09-25');
    assert.equal(interpretarData('10/09/2026', agora), '2026-09-10');
    assert.equal(interpretarData('31/02/2026', agora), '');
});

test('aceita número ou nome ao escolher uma opção', () => {
    assert.equal(resolverResposta('2', ['Nubank', 'Itaú']), 'Itaú');
    assert.equal(resolverResposta('nubank', ['Nubank', 'Itaú']), 'Nubank');
});

test('conduz uma saída até a confirmação', () => {
    let sessao = null;
    const agora = new Date('2026-09-26T15:00:00Z');
    for (const resposta of ['saída', 'Mercado', '25,90', 'hoje', 'crédito', '1', '2', '1', 'pular']) {
        const resultado = avancarConversa(sessao, resposta, dados, agora);
        sessao = resultado.sessao;
    }
    assert.equal(sessao.etapa, 'confirmacao');
    assert.deepEqual(sessao.campos, {
        type: 'expense', name: 'Mercado', amount: 25.9, date: '2026-09-26',
        paymentMethod: 'credit', account: 'Nubank', installments: 2,
        category: 'Alimentação', description: ''
    });
    const final = avancarConversa(sessao, 'confirmar', dados, agora);
    assert.equal(final.sessao, null);
    assert.equal(final.lancamento.name, 'Mercado');
});

test('conduz uma entrada e permite cancelar', () => {
    let resultado = avancarConversa(null, 'entrada', dados);
    resultado = avancarConversa(resultado.sessao, 'Freela', dados);
    resultado = avancarConversa(resultado.sessao, '500', dados);
    resultado = avancarConversa(resultado.sessao, 'ontem', dados, new Date('2026-09-26T15:00:00Z'));
    assert.equal(resultado.sessao.etapa, 'categoria');
    const cancelado = avancarConversa(resultado.sessao, 'cancelar', dados);
    assert.equal(cancelado.sessao, null);
});
