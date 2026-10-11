const { createHash, randomBytes } = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const {
    CATEGORIAS_ENTRADA,
    normalizarComparacao,
    obterCategorias,
    obterContas,
    texto
} = require('./domain');
const { interpretarData, interpretarValor } = require('./whatsapp-conversation');

const COLECAO_FLOW_TOKENS = '_gugetWhatsappFlowTokens';
const FLOW_TTL_MS = 30 * 60 * 1000;
const TIPO_POR_RESPOSTA = {
    expense: 'expense', saida: 'expense', gasto: 'expense', 'type:expense': 'expense',
    income: 'income', entrada: 'income', receita: 'income', 'type:income': 'income'
};

function hash(valor) {
    return createHash('sha256').update(String(valor)).digest('hex');
}

function tipoSolicitado(valor) {
    return TIPO_POR_RESPOSTA[normalizarComparacao(valor)] || '';
}

function opcoesFlow(valores, prefixo) {
    return valores.slice(0, 200).map((valor, indice) => ({
        id: `${prefixo}:${indice}`,
        title: Array.from(texto(valor, 80)).slice(0, 30).join('')
    }));
}

function montarPayloadFlow(destino, flowId, flowToken, tipo, dados, flowMode = 'published') {
    const contas = obterContas(dados).map(conta => conta.nome).filter(Boolean);
    const categorias = tipo === 'income' ? CATEGORIAS_ENTRADA : obterCategorias(dados);
    const accounts = opcoesFlow(contas, 'account');
    const categories = opcoesFlow(categorias, 'category');

    return {
        payload: {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: destino,
            type: 'interactive',
            interactive: {
                type: 'flow',
                header: { type: 'text', text: tipo === 'income' ? 'Nova entrada' : 'Nova saída' },
                body: { text: 'Preencha tudo de uma vez. Seus cartões e categorias já estão disponíveis no formulário.' },
                footer: { text: 'Cadastro rápido pelo GugetFin' },
                action: {
                    name: 'flow',
                    parameters: {
                        flow_message_version: '3',
                        flow_mode: flowMode === 'draft' ? 'draft' : 'published',
                        flow_token: flowToken,
                        flow_id: String(flowId),
                        flow_cta: 'Preencher agora',
                        flow_action: 'navigate',
                        flow_action_payload: {
                            screen: tipo === 'income' ? 'INCOME_FORM' : 'EXPENSE_FORM',
                            data: {
                                categories,
                                ...(tipo === 'expense' ? {
                                    accounts: accounts.length
                                        ? accounts
                                        : [{ id: 'account:none', title: 'Nenhuma conta cadastrada' }]
                                } : {})
                            }
                        }
                    }
                }
            }
        },
        contexto: { tipo, contas, categorias }
    };
}

async function criarFlowToken(servicos, { uid, waId, tipo, contas, categorias }) {
    const token = randomBytes(32).toString('base64url');
    await servicos.db.collection(COLECAO_FLOW_TOKENS).doc(hash(token)).set({
        uid,
        waIdHash: hash(waId),
        tipo,
        contas,
        categorias,
        expiresAtMs: Date.now() + FLOW_TTL_MS,
        usedAt: null,
        createdAt: FieldValue.serverTimestamp()
    });
    return token;
}

async function prepararFlow(servicos, { uid, waId, tipo, dados }) {
    const flowId = texto(tipo === 'income'
        ? servicos.whatsAppIncomeFlowId
        : servicos.whatsAppExpenseFlowId, 80);
    if (!flowId || !['expense', 'income'].includes(tipo)) return null;

    const contas = obterContas(dados).map(conta => conta.nome).filter(Boolean);
    const categorias = tipo === 'income' ? CATEGORIAS_ENTRADA : obterCategorias(dados);
    if (!categorias.length) return null;

    const token = await criarFlowToken(servicos, { uid, waId, tipo, contas, categorias });
    const resultado = montarPayloadFlow(
        waId,
        flowId,
        token,
        tipo,
        dados,
        texto(servicos.whatsAppRegistrationFlowMode, 20) || 'published'
    );
    return { ...resultado, token, tokenRef: servicos.db.collection(COLECAO_FLOW_TOKENS).doc(hash(token)) };
}

function opcaoDoToken(valor, opcoes, prefixo, obrigatorio = true) {
    const correspondencia = String(valor || '').match(new RegExp(`^${prefixo}:(\\d+)$`));
    const indice = correspondencia ? Number.parseInt(correspondencia[1], 10) : -1;
    const opcao = indice >= 0 && indice < opcoes.length ? opcoes[indice] : '';
    if (!opcao && obrigatorio) throw new Error(`A opção de ${prefixo} não é mais válida.`);
    return opcao;
}

function normalizarRespostaFlow(resposta, token, agora = new Date()) {
    const tipo = texto(resposta?.type, 20);
    if (tipo !== token.tipo) throw new Error('O tipo de lançamento do formulário não confere.');

    const name = texto(resposta?.name, 120);
    const amount = interpretarValor(resposta?.amount);
    const date = interpretarData(resposta?.date, agora);
    const category = opcaoDoToken(resposta?.category, token.categorias || [], 'category');
    if (name.length < 2) throw new Error('Informe um nome com pelo menos 2 caracteres.');
    if (!amount) throw new Error('Informe um valor válido.');
    if (!date) throw new Error('Informe uma data válida.');

    const lancamento = {
        type: tipo,
        name,
        amount,
        date,
        category,
        description: texto(resposta?.description, 500)
    };
    if (tipo === 'expense') {
        const paymentMethod = texto(resposta?.payment_method, 20);
        if (!['credit', 'debit', 'pix', 'cash', 'fixed'].includes(paymentMethod)) {
            throw new Error('Escolha uma forma de pagamento válida.');
        }
        lancamento.paymentMethod = paymentMethod;
        if (paymentMethod !== 'cash') {
            lancamento.account = opcaoDoToken(resposta?.account, token.contas || [], 'account');
        }
        if (paymentMethod === 'credit') {
            const installments = Number.parseInt(String(resposta?.installments || '1'), 10);
            if (!Number.isInteger(installments) || installments < 1 || installments > 60) {
                throw new Error('As parcelas devem ser um número entre 1 e 60.');
            }
            lancamento.installments = installments;
        }
    }
    return lancamento;
}

async function consumirRespostaFlow(servicos, { resposta, uid, waId, agora = new Date() }) {
    const flowToken = texto(resposta?.flow_token, 200);
    if (flowToken.length < 32) throw new Error('O formulário expirou. Abra um novo cadastro.');
    const tokenRef = servicos.db.collection(COLECAO_FLOW_TOKENS).doc(hash(flowToken));
    const tokenSnap = await tokenRef.get();
    const token = tokenSnap.data();
    if (!tokenSnap.exists || token?.usedAt || Number(token?.expiresAtMs || 0) <= Date.now()
        || token?.uid !== uid || token?.waIdHash !== hash(waId)) {
        throw new Error('O formulário expirou ou já foi utilizado. Abra um novo cadastro.');
    }
    return { lancamento: normalizarRespostaFlow(resposta, token, agora), tokenRef };
}

module.exports = {
    COLECAO_FLOW_TOKENS,
    consumirRespostaFlow,
    montarPayloadFlow,
    normalizarRespostaFlow,
    prepararFlow,
    tipoSolicitado
};
