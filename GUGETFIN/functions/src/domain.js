const { randomUUID } = require('node:crypto');

const CATEGORIAS_ENTRADA = ['Projetos / Serviços', 'Fixo / Contrato', 'Renda Extra'];
const FORMAS_PAGAMENTO = {
    credit: { tipo: 'cartao', formaPagamento: null },
    credito: { tipo: 'cartao', formaPagamento: null },
    cartao: { tipo: 'cartao', formaPagamento: null },
    card: { tipo: 'cartao', formaPagamento: null },
    debit: { tipo: 'debito', formaPagamento: 'Débito' },
    debito: { tipo: 'debito', formaPagamento: 'Débito' },
    pix: { tipo: 'debito', formaPagamento: 'Pix' },
    cash: { tipo: 'debito', formaPagamento: 'Dinheiro' },
    dinheiro: { tipo: 'debito', formaPagamento: 'Dinheiro' },
    fixed: { tipo: 'fixo', formaPagamento: null },
    fixo: { tipo: 'fixo', formaPagamento: null }
};

class ApiError extends Error {
    constructor(status, code, message, details = undefined) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

function texto(valor, limite = 160) {
    return String(valor ?? '').trim().replace(/\s+/g, ' ').slice(0, limite);
}

function normalizarComparacao(valor) {
    return texto(valor, 200)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
}

function numeroPositivo(valor, campo) {
    let normalizado = valor;
    if (typeof valor === 'string') {
        const limpo = valor.replace(/[^\d,.-]/g, '');
        normalizado = limpo.includes(',')
            ? limpo.replace(/\./g, '').replace(',', '.')
            : limpo;
    }
    const numero = Number(normalizado);
    if (!Number.isFinite(numero) || numero <= 0 || numero > 999999999) {
        throw new ApiError(400, 'invalid_amount', `${campo} deve ser um número maior que zero.`);
    }
    return Math.round((numero + Number.EPSILON) * 100) / 100;
}

function inteiroEntre(valor, minimo, maximo, fallback) {
    const numero = Number.parseInt(valor, 10);
    if (!Number.isFinite(numero)) return fallback;
    return Math.max(minimo, Math.min(maximo, numero));
}

function hojeEmSaoPaulo(agora = new Date()) {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(agora);
    const mapa = Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
    return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

function dataIso(valor, agora = new Date()) {
    const candidata = texto(valor || hojeEmSaoPaulo(agora), 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidata)) {
        throw new ApiError(400, 'invalid_date', 'A data deve usar o formato AAAA-MM-DD.');
    }
    const data = new Date(`${candidata}T12:00:00Z`);
    if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== candidata) {
        throw new ApiError(400, 'invalid_date', 'A data informada não existe.');
    }
    return candidata;
}

function resolverOpcao(valor, opcoes, campo, obrigatorio = true) {
    const procurado = normalizarComparacao(valor);
    const validas = (Array.isArray(opcoes) ? opcoes : []).filter(Boolean);
    if (!procurado) {
        if (!obrigatorio) return '';
        throw new ApiError(400, `missing_${campo}`, `Informe ${campo}.`);
    }

    const encontrada = validas.find(opcao => normalizarComparacao(
        typeof opcao === 'string' ? opcao : opcao.nome
    ) === procurado);
    if (!encontrada) {
        throw new ApiError(422, `unknown_${campo}`, `${campo} não encontrado na conta do usuário.`, {
            received: texto(valor),
            available: validas.map(opcao => typeof opcao === 'string' ? opcao : opcao.nome).filter(Boolean)
        });
    }
    return typeof encontrada === 'string' ? encontrada : encontrada.nome;
}

function obterContas(dados) {
    const detalhes = Array.isArray(dados?.config?.detalhesBancos) ? dados.config.detalhesBancos : [];
    const nomesDetalhados = new Set(detalhes.map(conta => normalizarComparacao(conta?.nome)));
    const legadas = (Array.isArray(dados?.config?.bancos) ? dados.config.bancos : [])
        .filter(nome => !nomesDetalhados.has(normalizarComparacao(nome)))
        .map(nome => ({ nome }));
    return [...detalhes, ...legadas].filter(conta => {
        const nome = normalizarComparacao(conta?.nome);
        return nome && nome !== 'cadastre seus cartoes!';
    });
}

function obterCategorias(dados) {
    return (Array.isArray(dados?.config?.categorias) ? dados.config.categorias : [])
        .map(categoria => texto(categoria, 80))
        .filter(Boolean);
}

function normalizarTipoLancamento(body) {
    const recebido = normalizarComparacao(body?.type || body?.kind || body?.tipo);
    if (['expense', 'saida', 'gasto'].includes(recebido)) return 'expense';
    if (['income', 'entrada', 'receita'].includes(recebido)) return 'income';
    throw new ApiError(400, 'invalid_type', 'type deve ser expense ou income.');
}

function criarGasto(body, dados, contexto) {
    const nome = texto(body.name || body.nome, 120);
    if (!nome) throw new ApiError(400, 'missing_name', 'Informe o nome do gasto.');

    const valorTotal = numeroPositivo(body.amount ?? body.valor, 'amount');
    const dataCompra = dataIso(body.date || body.data, contexto.now);
    const chavePagamento = normalizarComparacao(
        body.paymentMethod || body.formaPagamento || body.method || 'debit'
    );
    const pagamento = FORMAS_PAGAMENTO[chavePagamento];
    if (!pagamento) {
        throw new ApiError(400, 'invalid_payment_method', 'Forma de pagamento inválida.', {
            available: ['credit', 'debit', 'pix', 'cash', 'fixed']
        });
    }

    const categoria = resolverOpcao(body.category || body.categoria, obterCategorias(dados), 'category');
    const exigeConta = pagamento.formaPagamento !== 'Dinheiro';
    const banco = exigeConta
        ? resolverOpcao(body.account || body.accountName || body.conta || body.cartao || body.banco, obterContas(dados), 'account')
        : '';
    const parcelas = pagamento.tipo === 'cartao'
        ? inteiroEntre(body.installments ?? body.parcelas, 1, 60, 1)
        : 1;
    const criadoEm = contexto.now.getTime();

    return {
        id: contexto.transactionId,
        apiId: contexto.transactionId,
        nome,
        tipo: pagamento.tipo,
        valorTotal,
        valorParcela: Math.round(((valorTotal / parcelas) + Number.EPSILON) * 100) / 100,
        parcelas,
        dataCompra,
        banco,
        categoria,
        observacao: texto(body.description || body.descricao || body.observacao, 500),
        pago: false,
        delayPagamento: pagamento.tipo === 'cartao'
            ? inteiroEntre(body.startDelay ?? body.inicioPagamento, 0, 60, 0)
            : 0,
        eDeTerceiro: false,
        nomeTerceiro: '',
        terceiro: null,
        formaPagamento: pagamento.formaPagamento,
        comprovanteUrl: '',
        criadoEm,
        destaqueAte: criadoEm + (5 * 60 * 1000),
        origemApi: true,
        apiCliente: texto(contexto.clientName || 'Integração externa', 80),
        apiKeyId: contexto.keyId || null,
        apiIdempotencyHash: contexto.idempotencyHash || null
    };
}

function criarEntrada(body, dados, contexto) {
    const nome = texto(body.name || body.nome, 120);
    if (!nome) throw new ApiError(400, 'missing_name', 'Informe o nome da entrada.');

    const valor = numeroPositivo(body.amount ?? body.valor, 'amount');
    const dataRecebimento = dataIso(body.date || body.data, contexto.now);
    const categoriaRecebida = texto(body.category || body.categoria || 'Renda Extra', 80);
    const categoria = resolverOpcao(categoriaRecebida, CATEGORIAS_ENTRADA, 'category');
    const [ano, mes] = dataRecebimento.split('-').map(Number);

    return {
        id: contexto.transactionId,
        apiId: contexto.transactionId,
        nome,
        cliente: texto(body.source || body.client || body.origem || body.cliente, 120),
        categoria,
        observacao: texto(body.description || body.descricao || body.observacao, 500),
        valor,
        mes: mes - 1,
        ano,
        dataRecebimento,
        projetoId: '',
        valorTotalProjeto: valor,
        parcelaAtual: 1,
        totalParcelas: 1,
        comprovanteUrl: '',
        criadoEm: contexto.now.getTime(),
        origemApi: true,
        apiCliente: texto(contexto.clientName || 'Integração externa', 80),
        apiKeyId: contexto.keyId || null,
        apiIdempotencyHash: contexto.idempotencyHash || null
    };
}

function criarLancamentoApi(body, dados, contexto = {}) {
    const now = contexto.now instanceof Date ? contexto.now : new Date();
    const transactionId = contexto.transactionId || randomUUID();
    const completo = { ...contexto, now, transactionId };
    const tipo = normalizarTipoLancamento(body || {});
    const item = tipo === 'expense'
        ? criarGasto(body || {}, dados || {}, completo)
        : criarEntrada(body || {}, dados || {}, completo);
    return { tipo, item };
}

function serializarLancamento(tipo, item) {
    if (tipo === 'income') {
        return {
            id: item.apiId || item.id,
            type: 'income',
            name: item.nome,
            amount: Number(item.valor || 0),
            date: item.dataRecebimento,
            category: item.categoria,
            source: item.cliente || '',
            description: item.observacao || '',
            createdViaApi: item.origemApi === true
        };
    }
    return {
        id: item.apiId || item.id,
        type: 'expense',
        name: item.nome,
        amount: Number(item.valorTotal || 0),
        installmentAmount: Number(item.valorParcela || 0),
        installments: Number(item.parcelas || 1),
        date: item.dataCompra,
        category: item.categoria,
        account: item.banco || '',
        paymentMethod: item.tipo === 'cartao'
            ? 'credit'
            : (item.formaPagamento === 'Pix' ? 'pix' : (item.formaPagamento === 'Dinheiro' ? 'cash' : (item.tipo === 'fixo' ? 'fixed' : 'debit'))),
        description: item.observacao || '',
        createdViaApi: item.origemApi === true
    };
}

module.exports = {
    ApiError,
    CATEGORIAS_ENTRADA,
    criarLancamentoApi,
    dataIso,
    hojeEmSaoPaulo,
    normalizarComparacao,
    obterCategorias,
    obterContas,
    serializarLancamento,
    texto
};
