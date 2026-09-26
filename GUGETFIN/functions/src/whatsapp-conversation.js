const {
    CATEGORIAS_ENTRADA,
    hojeEmSaoPaulo,
    normalizarComparacao,
    obterCategorias,
    obterContas,
    texto
} = require('./domain');

function moeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function lista(opcoes) {
    return opcoes.map((opcao, indice) => `${indice + 1}. ${opcao}`).join('\n');
}

function resolverResposta(valor, opcoes) {
    const normalizado = normalizarComparacao(valor);
    const indice = Number.parseInt(normalizado, 10);
    if (Number.isInteger(indice) && indice >= 1 && indice <= opcoes.length) return opcoes[indice - 1];
    return opcoes.find(opcao => normalizarComparacao(opcao) === normalizado) || '';
}

function interpretarValor(valor) {
    const limpo = texto(valor, 80)
        .replace(/r\$/gi, '')
        .replace(/reais?/gi, '')
        .replace(/\s/g, '')
        .replace(/\.(?=\d{3}(?:\D|$))/g, '')
        .replace(',', '.');
    const numero = Number(limpo);
    return Number.isFinite(numero) && numero > 0 && numero <= 999999999
        ? Math.round((numero + Number.EPSILON) * 100) / 100
        : null;
}

function interpretarData(valor, agora = new Date()) {
    const normalizado = normalizarComparacao(valor);
    const hoje = hojeEmSaoPaulo(agora);
    if (['hoje', 'agora'].includes(normalizado)) return hoje;
    if (normalizado === 'ontem') {
        const data = new Date(`${hoje}T12:00:00-03:00`);
        data.setDate(data.getDate() - 1);
        return data.toISOString().slice(0, 10);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizado)) {
        const data = new Date(`${normalizado}T12:00:00Z`);
        return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === normalizado
            ? normalizado
            : '';
    }
    const brasileira = normalizado.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
    if (!brasileira) return '';
    const anoAtual = Number(hoje.slice(0, 4));
    let ano = brasileira[3] ? Number(brasileira[3]) : anoAtual;
    if (ano < 100) ano += 2000;
    const candidata = `${ano}-${String(Number(brasileira[2])).padStart(2, '0')}-${String(Number(brasileira[1])).padStart(2, '0')}`;
    const data = new Date(`${candidata}T12:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === candidata ? candidata : '';
}

function inicio() {
    return 'Olá! Sou o GugetFin no WhatsApp. Você quer cadastrar uma *entrada* ou uma *saída*?\n\nVocê também pode escrever *cancelar* a qualquer momento.';
}

function resumo(campos) {
    const linhas = [
        `*${campos.type === 'income' ? 'Entrada' : 'Saída'}*`,
        `Nome: ${campos.name}`,
        `Valor: ${moeda(campos.amount)}`,
        `Data: ${campos.date.split('-').reverse().join('/')}`,
        `Categoria: ${campos.category}`
    ];
    if (campos.type === 'expense') {
        linhas.push(`Pagamento: ${campos.paymentMethod}`);
        if (campos.account) linhas.push(`Conta/cartão: ${campos.account}`);
        if (campos.installments > 1) linhas.push(`Parcelas: ${campos.installments}x`);
    }
    if (campos.description) linhas.push(`Descrição: ${campos.description}`);
    return `${linhas.join('\n')}\n\nDigite *confirmar* para cadastrar ou *cancelar* para desistir.`;
}

function avancarConversa(sessaoAtual, entrada, dados, agora = new Date()) {
    const recebido = texto(entrada, 500);
    const normalizado = normalizarComparacao(recebido);
    const sessao = sessaoAtual && typeof sessaoAtual === 'object'
        ? {
            etapa: sessaoAtual.etapa || 'inicio',
            campos: { ...(sessaoAtual.campos || {}) },
            ...(Array.isArray(sessaoAtual.opcoes) ? { opcoes: [...sessaoAtual.opcoes] } : {})
        }
        : { etapa: 'inicio', campos: {} };

    if (['cancelar', 'cancela', 'sair', 'menu', 'reiniciar'].includes(normalizado)) {
        return { resposta: `Cadastro cancelado.\n\n${inicio()}`, sessao: null };
    }

    if (sessao.etapa === 'inicio') {
        if (['entrada', 'receita'].includes(normalizado)) {
            return { resposta: 'Qual é o nome dessa entrada?', sessao: { etapa: 'nome', campos: { type: 'income' } } };
        }
        if (['saida', 'gasto', 'despesa'].includes(normalizado)) {
            return { resposta: 'Qual é o nome do gasto?', sessao: { etapa: 'nome', campos: { type: 'expense' } } };
        }
        return { resposta: inicio(), sessao };
    }

    if (sessao.etapa === 'nome') {
        if (recebido.length < 2) return { resposta: 'Digite um nome com pelo menos 2 caracteres.', sessao };
        sessao.campos.name = recebido;
        sessao.etapa = 'valor';
        return { resposta: 'Qual é o valor? Exemplo: *25,90*', sessao };
    }

    if (sessao.etapa === 'valor') {
        const valor = interpretarValor(recebido);
        if (!valor) return { resposta: 'Não entendi o valor. Digite, por exemplo, *25,90*.', sessao };
        sessao.campos.amount = valor;
        sessao.etapa = 'data';
        return { resposta: 'Qual é a data? Você pode responder *hoje*, *ontem* ou usar *DD/MM/AAAA*.', sessao };
    }

    if (sessao.etapa === 'data') {
        const data = interpretarData(recebido, agora);
        if (!data) return { resposta: 'Não entendi a data. Use *hoje*, *ontem* ou *DD/MM/AAAA*.', sessao };
        sessao.campos.date = data;
        if (sessao.campos.type === 'income') {
            sessao.etapa = 'categoria';
            sessao.opcoes = CATEGORIAS_ENTRADA;
            return { resposta: `Qual é a categoria?\n${lista(sessao.opcoes)}`, sessao };
        }
        sessao.etapa = 'pagamento';
        return { resposta: 'Como foi pago? Responda *crédito*, *débito*, *Pix*, *dinheiro* ou *fixo*.', sessao };
    }

    if (sessao.etapa === 'pagamento') {
        const metodos = {
            credito: 'credit', cartao: 'credit',
            debito: 'debit', pix: 'pix', dinheiro: 'cash', fixo: 'fixed'
        };
        const metodo = metodos[normalizado];
        if (!metodo) return { resposta: 'Escolha: *crédito*, *débito*, *Pix*, *dinheiro* ou *fixo*.', sessao };
        sessao.campos.paymentMethod = metodo;
        if (metodo === 'cash') {
            sessao.etapa = 'categoria';
            sessao.opcoes = obterCategorias(dados);
            return { resposta: `Qual é a categoria?\n${lista(sessao.opcoes)}`, sessao };
        }
        const contas = obterContas(dados).map(conta => conta.nome).filter(Boolean);
        if (!contas.length) return { resposta: 'Você ainda não tem uma conta ou cartão cadastrado no GugetFin. Cadastre um no site e tente novamente.', sessao: null };
        sessao.etapa = 'conta';
        sessao.opcoes = contas;
        return { resposta: `Qual conta ou cartão foi usado?\n${lista(contas)}`, sessao };
    }

    if (sessao.etapa === 'conta') {
        const conta = resolverResposta(recebido, sessao.opcoes || []);
        if (!conta) return { resposta: `Escolha uma das opções:\n${lista(sessao.opcoes || [])}`, sessao };
        sessao.campos.account = conta;
        if (sessao.campos.paymentMethod === 'credit') {
            sessao.etapa = 'parcelas';
            return { resposta: 'Em quantas parcelas? Digite *1* se foi à vista.', sessao };
        }
        sessao.etapa = 'categoria';
        sessao.opcoes = obterCategorias(dados);
        return { resposta: `Qual é a categoria?\n${lista(sessao.opcoes)}`, sessao };
    }

    if (sessao.etapa === 'parcelas') {
        const parcelas = Number.parseInt(normalizado, 10);
        if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 60) {
            return { resposta: 'Digite uma quantidade de parcelas entre 1 e 60.', sessao };
        }
        sessao.campos.installments = parcelas;
        sessao.etapa = 'categoria';
        sessao.opcoes = obterCategorias(dados);
        return { resposta: `Qual é a categoria?\n${lista(sessao.opcoes)}`, sessao };
    }

    if (sessao.etapa === 'categoria') {
        if (!Array.isArray(sessao.opcoes) || !sessao.opcoes.length) {
            return { resposta: 'Você ainda não tem categorias cadastradas no GugetFin. Cadastre uma no site e tente novamente.', sessao: null };
        }
        const categoria = resolverResposta(recebido, sessao.opcoes);
        if (!categoria) return { resposta: `Escolha uma das opções:\n${lista(sessao.opcoes)}`, sessao };
        sessao.campos.category = categoria;
        sessao.etapa = 'descricao';
        delete sessao.opcoes;
        return { resposta: 'Quer adicionar uma descrição? Digite o texto ou responda *pular*.', sessao };
    }

    if (sessao.etapa === 'descricao') {
        sessao.campos.description = ['pular', 'nao', 'não', 'nenhuma', 'sem descricao'].includes(normalizado) ? '' : recebido;
        sessao.etapa = 'confirmacao';
        return { resposta: resumo(sessao.campos), sessao };
    }

    if (sessao.etapa === 'confirmacao') {
        if (['confirmar', 'confirmo', 'sim', 'pode cadastrar'].includes(normalizado)) {
            return { resposta: '', sessao: null, lancamento: { ...sessao.campos } };
        }
        return { resposta: 'Digite *confirmar* para cadastrar ou *cancelar* para desistir.', sessao };
    }

    return { resposta: inicio(), sessao: null };
}

module.exports = {
    avancarConversa,
    inicio,
    interpretarData,
    interpretarValor,
    resolverResposta
};
