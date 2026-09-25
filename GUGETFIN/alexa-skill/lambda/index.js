const Alexa = require('ask-sdk-core');
const axios = require('axios');

const API_URL = process.env.GUGETFIN_API_URL
    || 'https://southamerica-east1-guget-fin.cloudfunctions.net/api/v1';

function tokenUsuario(handlerInput) {
    return handlerInput.requestEnvelope?.context?.System?.user?.accessToken
        || handlerInput.requestEnvelope?.session?.user?.accessToken
        || '';
}

function respostaVincular(handlerInput) {
    return handlerInput.responseBuilder
        .speak('Para usar o GugetFin, vincule sua conta no aplicativo Alexa. Depois, volte e abra a Skill novamente.')
        .withLinkAccountCard()
        .getResponse();
}

async function api(handlerInput, method, path, data) {
    const accessToken = tokenUsuario(handlerInput);
    if (!accessToken) {
        const error = new Error('account_not_linked');
        error.code = 'account_not_linked';
        throw error;
    }
    try {
        const response = await axios({
            baseURL: API_URL,
            url: path,
            method,
            data,
            timeout: 8000,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': handlerInput.requestEnvelope?.request?.requestId || ''
            }
        });
        return response.data?.data;
    } catch (error) {
        const payload = error.response?.data?.error;
        error.code = payload?.code || error.code || 'api_error';
        error.userMessage = payload?.message || 'O GugetFin não respondeu agora.';
        error.details = payload?.details;
        throw error;
    }
}

function slot(intent, nome) {
    return intent?.slots?.[nome]?.value || '';
}

function normalizar(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function formaPagamento(valor) {
    const forma = normalizar(valor);
    if (forma.includes('credito') || forma.includes('cartao')) return 'credit';
    if (forma.includes('pix')) return 'pix';
    if (forma.includes('dinheiro') || forma.includes('especie')) return 'cash';
    if (forma.includes('fix')) return 'fixed';
    return 'debit';
}

function descricao(valor) {
    const normalizada = normalizar(valor);
    if (!normalizada || ['nao', 'nenhuma', 'sem', 'sem descricao'].includes(normalizada)) return '';
    return String(valor).trim();
}

function categoriaEntrada(valor) {
    const normalizada = normalizar(valor);
    if (normalizada.includes('projeto') || normalizada.includes('servico')) return 'Projetos / Serviços';
    if (normalizada.includes('fixo') || normalizada.includes('contrato')) return 'Fixo / Contrato';
    return 'Renda Extra';
}

function dataValida(valor) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''));
}

function valorNumero(valor) {
    const numero = Number(String(valor || '').replace(',', '.'));
    return Number.isFinite(numero) ? numero : 0;
}

function definirSlot(intent, nome, valor) {
    if (!intent.slots) intent.slots = {};
    intent.slots[nome] = {
        name: nome,
        value: String(valor),
        confirmationStatus: 'NONE'
    };
}

function prepararSaida(intent) {
    const forma = formaPagamento(slot(intent, 'formaPagamento'));
    if (slot(intent, 'formaPagamento') && forma !== 'credit' && !slot(intent, 'parcelas')) {
        definirSlot(intent, 'parcelas', '1');
    }
    if (slot(intent, 'formaPagamento') && forma === 'cash' && !slot(intent, 'conta')) {
        definirSlot(intent, 'conta', 'Dinheiro');
    }
    return intent;
}

function entidadeDinamica(nome, valores) {
    const unicos = [...new Set((valores || []).map(String).map(v => v.trim()).filter(Boolean))];
    return {
        name: nome,
        values: unicos.map((value, index) => ({
            id: `${nome.toLowerCase()}-${index + 1}`,
            name: { value }
        }))
    };
}

function diretivaEntidades(contas, categorias) {
    const types = [];
    if (contas?.length) types.push(entidadeDinamica('GU_CONTA', contas.map(item => item.name)));
    if (categorias?.length) types.push(entidadeDinamica('GU_CATEGORIA', categorias));
    return types.length ? {
        type: 'Dialog.UpdateDynamicEntities',
        updateBehavior: 'REPLACE',
        types
    } : null;
}

function mensagemErroApi(error) {
    if (error.code === 'unknown_account') {
        const opcoes = error.details?.available?.slice(0, 5).join(', ');
        return `Não encontrei essa conta. As opções cadastradas são ${opcoes || 'as exibidas no GugetFin'}. Tente novamente.`;
    }
    if (error.code === 'unknown_category') {
        const opcoes = error.details?.available?.slice(0, 5).join(', ');
        return `Não encontrei essa categoria. Você pode usar ${opcoes || 'uma categoria cadastrada no GugetFin'}. Tente novamente.`;
    }
    if (['invalid_token', 'expired_token'].includes(error.code)) {
        return 'A conexão com o GugetFin expirou. Abra o aplicativo Alexa e vincule sua conta novamente.';
    }
    return error.userMessage || 'Não consegui acessar o GugetFin agora. Tente novamente em instantes.';
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        if (!tokenUsuario(handlerInput)) return respostaVincular(handlerInput);
        try {
            const [perfil, contas, categorias] = await Promise.all([
                api(handlerInput, 'GET', '/me'),
                api(handlerInput, 'GET', '/accounts'),
                api(handlerInput, 'GET', '/categories')
            ]);
            const nome = String(perfil?.name || '').split(' ')[0];
            const diretiva = diretivaEntidades(contas, categorias?.expenses);
            const builder = handlerInput.responseBuilder
                .speak(`Olá${nome ? `, ${nome}` : ''}! Você quer cadastrar uma entrada ou uma saída?`)
                .reprompt('Diga entrada ou saída.');
            if (diretiva) builder.addDirective(diretiva);
            return builder.getResponse();
        } catch (error) {
            if (['account_not_linked', 'invalid_token', 'expired_token'].includes(error.code)) return respostaVincular(handlerInput);
            return handlerInput.responseBuilder
                .speak(mensagemErroApi(error))
                .reprompt('Você pode tentar novamente dizendo entrada ou saída.')
                .getResponse();
        }
    }
};

const CadastrarSaidaIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CadastrarSaidaIntent';
    },
    async handle(handlerInput) {
        if (!tokenUsuario(handlerInput)) return respostaVincular(handlerInput);
        const request = handlerInput.requestEnvelope.request;
        const intent = prepararSaida(request.intent);
        if (request.dialogState !== 'COMPLETED') {
            return handlerInput.responseBuilder.addDelegateDirective(intent).getResponse();
        }

        const data = slot(intent, 'data');
        if (!dataValida(data)) {
            return handlerInput.responseBuilder
                .speak('Não consegui entender essa data. Diga, por exemplo, hoje, ontem ou vinte e quatro de setembro.')
                .reprompt('Qual foi o dia da compra?')
                .getResponse();
        }

        try {
            const criada = await api(handlerInput, 'POST', '/transactions', {
                type: 'expense',
                name: slot(intent, 'nome'),
                amount: valorNumero(slot(intent, 'valor')),
                date: data,
                paymentMethod: formaPagamento(slot(intent, 'formaPagamento')),
                installments: Number.parseInt(slot(intent, 'parcelas'), 10) || 1,
                account: slot(intent, 'conta'),
                category: slot(intent, 'categoria'),
                description: descricao(slot(intent, 'descricao'))
            });
            return handlerInput.responseBuilder
                .speak(`Pronto. A saída ${criada.name}, no valor de ${criada.amount} reais, foi cadastrada no GugetFin.`)
                .reprompt('Quer cadastrar mais alguma coisa?')
                .getResponse();
        } catch (error) {
            return handlerInput.responseBuilder
                .speak(mensagemErroApi(error))
                .reprompt('Você pode tentar cadastrar a saída novamente.')
                .getResponse();
        }
    }
};

const CadastrarEntradaIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CadastrarEntradaIntent';
    },
    async handle(handlerInput) {
        if (!tokenUsuario(handlerInput)) return respostaVincular(handlerInput);
        const request = handlerInput.requestEnvelope.request;
        if (request.dialogState !== 'COMPLETED') {
            return handlerInput.responseBuilder.addDelegateDirective(request.intent).getResponse();
        }

        const intent = request.intent;
        const data = slot(intent, 'data');
        if (!dataValida(data)) {
            return handlerInput.responseBuilder
                .speak('Não consegui entender essa data. Diga, por exemplo, hoje, ontem ou vinte e quatro de setembro.')
                .reprompt('Qual foi a data da entrada?')
                .getResponse();
        }

        try {
            const criada = await api(handlerInput, 'POST', '/transactions', {
                type: 'income',
                name: slot(intent, 'nome'),
                amount: valorNumero(slot(intent, 'valor')),
                date: data,
                category: categoriaEntrada(slot(intent, 'categoria')),
                source: slot(intent, 'origem'),
                description: descricao(slot(intent, 'descricao'))
            });
            return handlerInput.responseBuilder
                .speak(`Pronto. A entrada ${criada.name}, no valor de ${criada.amount} reais, foi cadastrada no GugetFin.`)
                .reprompt('Quer cadastrar mais alguma coisa?')
                .getResponse();
        } catch (error) {
            return handlerInput.responseBuilder
                .speak(mensagemErroApi(error))
                .reprompt('Você pode tentar cadastrar a entrada novamente.')
                .getResponse();
        }
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('Eu posso cadastrar entradas e saídas no GugetFin. Diga, por exemplo, cadastrar uma saída.')
            .reprompt('Você quer cadastrar uma entrada ou uma saída?')
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && ['AMAZON.CancelIntent', 'AMAZON.StopIntent'].includes(Alexa.getIntentName(handlerInput.requestEnvelope));
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder.speak('Tudo certo. Até mais!').getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('Não entendi. Diga entrada para cadastrar um dinheiro recebido, ou saída para cadastrar um gasto.')
            .reprompt('Você quer cadastrar uma entrada ou uma saída?')
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() { return true; },
    handle(handlerInput, error) {
        console.error('Erro na Skill GugetFin', error);
        return handlerInput.responseBuilder
            .speak('Tive um problema ao processar isso. Tente novamente.')
            .reprompt('Você quer cadastrar uma entrada ou uma saída?')
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        CadastrarSaidaIntentHandler,
        CadastrarEntradaIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();

exports._test = {
    categoriaEntrada,
    dataValida,
    descricao,
    formaPagamento,
    normalizar,
    valorNumero
};
