/* ========================================================= */
/* GUGET ASSISTANT - SIMULADOR LOCAL DE COMPRAS              */
/* ========================================================= */

const gugetAssistantState = {
    etapa: 'inicio',
    valor: 0,
    pagamento: '',
    parcelas: 1,
    cartao: '',
    processando: false,
    ciclo: 0
};

function assistantEscaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[caractere]);
}

function assistantNormalizar(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function assistantMoeda(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function assistantMes(data, incluirAno = false) {
    const texto = data.toLocaleDateString('pt-BR', {
        month: 'short',
        year: incluirAno ? 'numeric' : undefined
    }).replace('.', '');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function assistantAdicionarMes(data, quantidade) {
    return new Date(data.getFullYear(), data.getMonth() + quantidade, 1, 12);
}

function assistantHojeIso() {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

function assistantPrimeiroNome() {
    const perfil = salsiData?.config?.perfil || {};
    const nome = perfil.nome || window.auth?.currentUser?.displayName || 'você';
    return String(nome).trim().split(/\s+/)[0] || 'você';
}

function assistantAvatarUsuario() {
    const perfil = salsiData?.config?.perfil || {};
    return window.auth?.currentUser?.photoURL || perfil.avatar || 'assets/user.jpg';
}

function assistantRolagemFinal() {
    const chat = document.getElementById('chat-messages');
    if (!chat) return;
    requestAnimationFrame(() => {
        chat.scrollTop = chat.scrollHeight;
    });
}

function assistantCriarAvatar(tipo) {
    const avatar = document.createElement('span');
    avatar.className = 'guget-assistant-message-avatar';
    avatar.setAttribute('aria-hidden', 'true');

    if (tipo === 'user') {
        const img = document.createElement('img');
        img.alt = '';
        img.src = assistantAvatarUsuario();
        img.addEventListener('error', () => {
            img.src = 'assets/user.jpg';
        }, { once: true });
        avatar.appendChild(img);
    } else {
        const icon = document.createElement('i');
        icon.className = 'fi fi-rr-comment-alt';
        avatar.appendChild(icon);
    }

    return avatar;
}

function assistantAdicionarMensagem(tipo, conteudo, permiteHtml = false) {
    const chat = document.getElementById('chat-messages');
    if (!chat) return null;

    const linha = document.createElement('div');
    linha.className = `guget-assistant-message${tipo === 'user' ? ' is-user' : ''}`;
    linha.appendChild(assistantCriarAvatar(tipo));

    const bolha = document.createElement('div');
    bolha.className = 'guget-assistant-bubble';
    if (permiteHtml) {
        bolha.innerHTML = conteudo;
    } else {
        const paragrafo = document.createElement('p');
        paragrafo.textContent = conteudo;
        bolha.appendChild(paragrafo);
    }
    linha.appendChild(bolha);
    chat.appendChild(linha);
    assistantRolagemFinal();
    return linha;
}

function assistantAdicionarDigitando() {
    const chat = document.getElementById('chat-messages');
    if (!chat) return null;

    const linha = document.createElement('div');
    linha.className = 'guget-assistant-message';
    linha.dataset.assistantTyping = 'true';
    linha.appendChild(assistantCriarAvatar('assistant'));

    const bolha = document.createElement('div');
    bolha.className = 'guget-assistant-bubble';
    bolha.innerHTML = '<span class="guget-assistant-typing" aria-label="Guget Assistant está digitando"><i></i><i></i><i></i></span>';
    linha.appendChild(bolha);
    chat.appendChild(linha);
    assistantRolagemFinal();
    return linha;
}

function assistantDefinirProcessando(ativo) {
    gugetAssistantState.processando = ativo;
    const input = document.getElementById('chat-input');
    const enviar = document.getElementById('guget-assistant-send');
    if (input) input.disabled = ativo;
    if (enviar) enviar.disabled = ativo;
}

function assistantDefinirOpcoes(opcoes = []) {
    const container = document.getElementById('guget-assistant-options');
    if (!container) return;
    container.innerHTML = '';

    opcoes.forEach(opcao => {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = `guget-assistant-option${opcao.secundaria ? ' is-secondary' : ''}`;
        botao.textContent = opcao.rotulo;
        botao.addEventListener('click', () => {
            if (gugetAssistantState.processando) return;
            if (typeof feedbackTatil === 'function') feedbackTatil('leve');
            assistantReceberResposta(opcao.valor, opcao.rotulo);
        });
        container.appendChild(botao);
    });
}

function assistantDefinirPlaceholder(texto) {
    const input = document.getElementById('chat-input');
    if (!input) return;
    input.placeholder = texto || 'Digite sua resposta...';
}

function assistantPerguntar(html, opcoes, etapa, placeholder = 'Digite sua resposta...', atraso = 360) {
    const ciclo = gugetAssistantState.ciclo;
    assistantDefinirProcessando(true);
    assistantDefinirOpcoes([]);
    const digitando = assistantAdicionarDigitando();

    window.setTimeout(() => {
        if (ciclo !== gugetAssistantState.ciclo) return;
        digitando?.remove();
        assistantAdicionarMensagem('assistant', html, true);
        gugetAssistantState.etapa = etapa;
        assistantDefinirOpcoes(opcoes);
        assistantDefinirPlaceholder(placeholder);
        assistantDefinirProcessando(false);
        document.getElementById('chat-input')?.focus({ preventScroll: true });
    }, atraso);
}

function assistantOpcoesIniciais() {
    return [
        { rotulo: 'Simular uma compra', valor: 'iniciar' },
        { rotulo: 'Agora não', valor: 'encerrar', secundaria: true }
    ];
}

function assistantReiniciarConversa() {
    gugetAssistantState.ciclo += 1;
    gugetAssistantState.etapa = 'inicio';
    gugetAssistantState.valor = 0;
    gugetAssistantState.pagamento = '';
    gugetAssistantState.parcelas = 1;
    gugetAssistantState.cartao = '';
    gugetAssistantState.processando = false;

    const chat = document.getElementById('chat-messages');
    const input = document.getElementById('chat-input');
    if (chat) chat.innerHTML = '';
    if (input) input.value = '';

    const nome = assistantEscaparHtml(assistantPrimeiroNome());
    assistantAdicionarMensagem('assistant', `
        <p>Oi, <strong>${nome}</strong>! Eu sou o <strong>Guget Assistant</strong>.</p>
        <p>Posso simular uma compra e mostrar como ela afetaria seus próximos meses. Quer consultar agora?</p>
    `, true);
    assistantDefinirOpcoes(assistantOpcoesIniciais());
    assistantDefinirPlaceholder('Digite sua resposta...');
    assistantDefinirProcessando(false);
}

function abrirAssistente() {
    const modal = document.getElementById('modal-assistente');
    if (!modal) return;
    assistantReiniciarConversa();
    if (typeof feedbackTatil === 'function') feedbackTatil('modal');
    if (!modal.open) modal.showModal();
    window.setTimeout(() => document.getElementById('chat-input')?.focus({ preventScroll: true }), 120);
}

function fecharAssistente() {
    gugetAssistantState.ciclo += 1;
    gugetAssistantState.processando = false;
    document.getElementById('modal-assistente')?.close();
}

function enviarPerguntaPronta(texto) {
    assistantReceberResposta(texto, texto);
}

function enviarMensagemAssistente(event) {
    if (event?.preventDefault) event.preventDefault();
    if (gugetAssistantState.processando) return;
    const input = document.getElementById('chat-input');
    const texto = input?.value?.trim();
    if (!texto) return;
    input.value = '';
    if (typeof feedbackTatil === 'function') feedbackTatil('leve');
    assistantReceberResposta(texto, texto);
}

function assistantParecePerguntaLivre(texto) {
    const normalizado = assistantNormalizar(texto);
    return texto.includes('?')
        || /\b(como|porque|por que|quando|onde|qual|quais|quanto posso|me diga|explique)\b/.test(normalizado)
        || normalizado.split(' ').length >= 5;
}

function assistantMensagemEmTreinamento() {
    assistantPerguntar(`
        <p>Ainda estou sendo treinado para responder esse tipo de consulta.</p>
        <p>Por enquanto, consigo te guiar na simulação de uma compra e calcular o impacto usando seus dados do GugetFin.</p>
    `, [
        { rotulo: 'Simular uma compra', valor: 'iniciar' },
        { rotulo: 'Cancelar conversa', valor: 'encerrar', secundaria: true }
    ], 'inicio', 'Digite sua resposta...');
}

function assistantCancelar() {
    assistantPerguntar(`
        <p>Tudo bem, simulação cancelada. Nenhuma compra foi cadastrada.</p>
        <p>Quando quiser, podemos começar novamente.</p>
    `, [
        { rotulo: 'Nova simulação', valor: 'iniciar' },
        { rotulo: 'Fechar', valor: 'fechar', secundaria: true }
    ], 'finalizado', 'Digite "nova simulação"...');
}

function assistantInterpretarValor(texto) {
    const valor = typeof parseValorMonetarioInput === 'function'
        ? parseValorMonetarioInput(texto)
        : Number(String(texto).replace(/[^\d,.-]/g, '').replace(',', '.'));
    return Number.isFinite(valor) ? valor : 0;
}

function assistantInterpretarPagamento(texto) {
    const valor = assistantNormalizar(texto);
    if (/credito|cartao/.test(valor) && !/debito/.test(valor)) return 'credito';
    if (/debito/.test(valor)) return 'debito';
    if (/pix/.test(valor)) return 'pix';
    if (/dinheiro|especie/.test(valor)) return 'dinheiro';
    return '';
}

function assistantInterpretarParcelas(texto) {
    const achou = assistantNormalizar(texto).match(/\d+/);
    const parcelas = achou ? Number(achou[0]) : 0;
    return Number.isInteger(parcelas) && parcelas >= 1 && parcelas <= 36 ? parcelas : 0;
}

function assistantCartoesCredito() {
    const detalhes = Array.isArray(salsiData?.config?.detalhesBancos) ? salsiData.config.detalhesBancos : [];
    const bancos = Array.isArray(salsiData?.config?.bancos) ? salsiData.config.bancos : [];
    const nomes = new Set();
    const cartoes = [];

    [...detalhes.map(item => item?.nome), ...bancos].forEach(nomeOriginal => {
        const nome = String(nomeOriginal || '').trim();
        const chave = assistantNormalizar(nome);
        if (!nome || nomes.has(chave) || chave.includes('cadastre seus cartoes')) return;
        const detalhe = detalhes.find(item => assistantNormalizar(item?.nome) === chave) || { nome };
        if (detalhe.isDebitoOnly || nome.toLowerCase().includes('(débito)')) return;
        nomes.add(chave);
        cartoes.push({ ...detalhe, nome });
    });

    return cartoes;
}

function assistantEncontrarCartao(texto) {
    const procurado = assistantNormalizar(texto);
    if (!procurado) return null;
    const cartoes = assistantCartoesCredito();
    return cartoes.find(cartao => assistantNormalizar(cartao.nome) === procurado)
        || cartoes.find(cartao => assistantNormalizar(cartao.nome).includes(procurado))
        || cartoes.find(cartao => procurado.includes(assistantNormalizar(cartao.nome)))
        || null;
}

function assistantPerguntarValor() {
    assistantPerguntar(`
        <p>Vamos lá. Qual é o <strong>valor total da compra</strong>?</p>
        <p>Você pode digitar, por exemplo, <strong>R$ 1.200</strong>.</p>
    `, [
        { rotulo: 'Cancelar', valor: 'cancelar', secundaria: true }
    ], 'valor', 'Ex: R$ 1.200,00');
}

function assistantPerguntarPagamento() {
    assistantPerguntar(`
        <p>Certo, uma compra de <strong class="guget-assistant-money">${assistantMoeda(gugetAssistantState.valor)}</strong>.</p>
        <p>Como você pretende pagar?</p>
    `, [
        { rotulo: 'Crédito', valor: 'credito' },
        { rotulo: 'Débito', valor: 'debito' },
        { rotulo: 'Pix', valor: 'pix' },
        { rotulo: 'Dinheiro', valor: 'dinheiro' },
        { rotulo: 'Cancelar', valor: 'cancelar', secundaria: true }
    ], 'pagamento', 'Digite ou escolha uma forma de pagamento');
}

function assistantPerguntarParcelas() {
    assistantPerguntar(`
        <p>Em quantas vezes você pretende parcelar?</p>
        <p>Aceito de <strong>1x a 36x</strong>.</p>
    `, [
        { rotulo: '1x', valor: '1' },
        { rotulo: '2x', valor: '2' },
        { rotulo: '3x', valor: '3' },
        { rotulo: '6x', valor: '6' },
        { rotulo: '10x', valor: '10' },
        { rotulo: '12x', valor: '12' },
        { rotulo: 'Cancelar', valor: 'cancelar', secundaria: true }
    ], 'parcelas', 'Ex: 8x');
}

function assistantPerguntarCartao() {
    const cartoes = assistantCartoesCredito();
    if (!cartoes.length) {
        assistantPerguntar(`
            <p>Não encontrei um cartão de crédito cadastrado.</p>
            <p>Posso fazer uma estimativa considerando que a primeira parcela entra neste mês. Quer continuar assim?</p>
        `, [
            { rotulo: 'Simular assim', valor: 'sem-cartao' },
            { rotulo: 'Cancelar', valor: 'cancelar', secundaria: true }
        ], 'cartao-ausente', 'Digite "simular" ou "cancelar"');
        return;
    }

    const opcoes = cartoes.map(cartao => ({ rotulo: cartao.nome, valor: cartao.nome }));
    opcoes.push({ rotulo: 'Cancelar', valor: 'cancelar', secundaria: true });
    assistantPerguntar(`
        <p>Qual cartão você usaria?</p>
        <p>Isso define em qual fatura a primeira parcela aparecerá.</p>
    `, opcoes, 'cartao', 'Digite ou escolha o cartão');
}

function assistantEntradasMes(referencia) {
    return (Array.isArray(salsiData?.entradas) ? salsiData.entradas : [])
        .filter(entrada => Number(entrada?.mes) === referencia.getMonth()
            && Number(entrada?.ano) === referencia.getFullYear()
            && entrada?.tipoEntrada !== 'resgate_caixinha')
        .reduce((total, entrada) => total + Math.max(0, Number(entrada?.valor || 0)), 0);
}

function assistantMediaRendaRecente(referencia) {
    const rendas = [];
    for (let deslocamento = 1; deslocamento <= 3; deslocamento += 1) {
        const valor = assistantEntradasMes(assistantAdicionarMes(referencia, -deslocamento));
        if (valor > 0) rendas.push(valor);
    }
    return rendas.length ? rendas.reduce((total, valor) => total + valor, 0) / rendas.length : 0;
}

function assistantCompromissosMes(referencia) {
    if (typeof insightsResumoMes === 'function') {
        const resumo = insightsResumoMes(referencia);
        return Math.max(0, Number(resumo.gastos || 0) + Number(resumo.pendente || 0));
    }

    let total = 0;
    (Array.isArray(salsiData?.transacoes) ? salsiData.transacoes : []).forEach(transacao => {
        if (transacao?.eDeTerceiro) return;
        try {
            const inicio = calcularCompetenciaInicialGasto(transacao);
            const diferenca = (referencia.getFullYear() - inicio.getFullYear()) * 12
                + (referencia.getMonth() - inicio.getMonth());
            const parcelas = Math.max(1, Number(transacao?.parcelas || 1));
            if (diferenca < 0 || diferenca >= parcelas) return;
            if (transacao.tipo === 'fixo' && transacao.pago !== true) return;
            total += transacao.tipo === 'cartao'
                ? Number(transacao.valorParcela || 0)
                : Number(transacao.valorTotal || 0);
        } catch (error) {}
    });
    return Math.max(0, total);
}

function assistantDistribuirParcelas(valor, parcelas) {
    const totalCentavos = Math.round(Number(valor || 0) * 100);
    const base = Math.floor(totalCentavos / parcelas);
    const resto = totalCentavos - (base * parcelas);
    return Array.from({ length: parcelas }, (_, indice) => (base + (indice < resto ? 1 : 0)) / 100);
}

function assistantPrimeiraCompetencia() {
    const hoje = new Date();
    if (gugetAssistantState.pagamento !== 'credito') {
        return new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12);
    }

    const hipotetica = {
        tipo: 'cartao',
        banco: gugetAssistantState.cartao,
        dataCompra: assistantHojeIso(),
        delayPagamento: 0
    };

    try {
        if (gugetAssistantState.cartao && typeof calcularCompetenciaInicialGasto === 'function') {
            const competencia = calcularCompetenciaInicialGasto(hipotetica);
            if (competencia instanceof Date && !Number.isNaN(competencia.getTime())) {
                return new Date(competencia.getFullYear(), competencia.getMonth(), 1, 12);
            }
        }
    } catch (error) {}

    return new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12);
}

function assistantAnalisarCompra() {
    const primeira = assistantPrimeiraCompetencia();
    const parcelas = gugetAssistantState.pagamento === 'credito' ? gugetAssistantState.parcelas : 1;
    const valores = assistantDistribuirParcelas(gugetAssistantState.valor, parcelas);
    const rendaMedia = assistantMediaRendaRecente(new Date());

    const meses = valores.map((valorParcela, indice) => {
        const referencia = assistantAdicionarMes(primeira, indice);
        const rendaCadastrada = assistantEntradasMes(referencia);
        const renda = rendaCadastrada > 0 ? rendaCadastrada : rendaMedia;
        const estimada = rendaCadastrada <= 0 && rendaMedia > 0;
        const compromissosAntes = assistantCompromissosMes(referencia);
        const compromissosDepois = compromissosAntes + valorParcela;
        const saldoAntes = renda > 0 ? renda - compromissosAntes : null;
        const saldoDepois = renda > 0 ? renda - compromissosDepois : null;
        const comprometimento = renda > 0 ? (compromissosDepois / renda) * 100 : null;
        return {
            referencia,
            valorParcela,
            renda,
            estimada,
            compromissosAntes,
            compromissosDepois,
            saldoAntes,
            saldoDepois,
            comprometimento
        };
    });

    const mesesComRenda = meses.filter(item => Number.isFinite(item.saldoDepois));
    const faltamDados = mesesComRenda.length !== meses.length;
    const maisApertado = (mesesComRenda.length ? mesesComRenda : meses)
        .reduce((pior, item) => {
            if (!pior) return item;
            if (Number.isFinite(item.saldoDepois) && Number.isFinite(pior.saldoDepois)) {
                return item.saldoDepois < pior.saldoDepois ? item : pior;
            }
            return item.compromissosDepois > pior.compromissosDepois ? item : pior;
        }, null);
    const maiorComprometimento = mesesComRenda.length
        ? Math.max(...mesesComRenda.map(item => item.comprometimento))
        : null;

    let nivel = 'neutral';
    let titulo = 'Impacto calculado; faltam entradas';
    let descricao = 'Consigo mostrar onde a compra cairia, mas ainda não há renda suficiente cadastrada para avaliar se ela cabe com segurança.';

    if (!faltamDados && maisApertado) {
        if (maisApertado.saldoDepois < 0 || maiorComprometimento >= 100) {
            nivel = 'danger';
            titulo = 'Não parece uma boa ideia agora';
            descricao = `${assistantMes(maisApertado.referencia, true)} ficaria com saldo previsto negativo considerando seus compromissos atuais.`;
        } else if (maiorComprometimento >= 80 || maisApertado.saldoDepois < (gugetAssistantState.valor / parcelas) * 1.5) {
            nivel = 'warning';
            titulo = 'Cabe, mas exige atenção';
            descricao = `${assistantMes(maisApertado.referencia, true)} seria o mês mais apertado depois desta compra.`;
        } else {
            nivel = 'good';
            titulo = 'Cabe com tranquilidade';
            descricao = 'A simulação mantém uma margem positiva nos meses afetados com os dados cadastrados hoje.';
        }
    }

    return {
        primeira,
        ultima: assistantAdicionarMes(primeira, parcelas - 1),
        parcelas,
        valores,
        meses,
        maisApertado,
        maiorComprometimento,
        faltamDados,
        usouEstimativa: meses.some(item => item.estimada),
        nivel,
        titulo,
        descricao
    };
}

function assistantIconeResultado(nivel) {
    if (nivel === 'good') return 'fi-rr-check-circle';
    if (nivel === 'warning') return 'fi-rr-triangle-warning';
    if (nivel === 'danger') return 'fi-rr-exclamation';
    return 'fi-rr-info';
}

function assistantAdicionarResultado(analise) {
    const chat = document.getElementById('chat-messages');
    if (!chat) return;

    const parcelaMedia = gugetAssistantState.valor / analise.parcelas;
    const impacto = analise.parcelas > 1
        ? `${assistantMoeda(parcelaMedia)}/mês`
        : assistantMoeda(gugetAssistantState.valor);
    const mesApertado = analise.maisApertado ? assistantMes(analise.maisApertado.referencia, true) : '—';
    const saldoApertado = Number.isFinite(analise.maisApertado?.saldoDepois)
        ? assistantMoeda(analise.maisApertado.saldoDepois)
        : 'Sem renda';
    const comprometimento = Number.isFinite(analise.maiorComprometimento)
        ? `${analise.maiorComprometimento.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
        : 'Não calculado';
    const mesesVisiveis = analise.meses.slice(0, 6);
    const restantes = Math.max(0, analise.meses.length - mesesVisiveis.length);

    const cartaoSemLimite = gugetAssistantState.pagamento === 'credito'
        ? ' O limite disponível do cartão não entra na avaliação porque esse dado ainda não é cadastrado no GugetFin.'
        : '';
    const origemRenda = analise.faltamDados
        ? 'Cadastre entradas para receber uma conclusão mais segura.'
        : analise.usouEstimativa
            ? 'Nos meses sem entrada cadastrada, usamos a média das entradas dos últimos três meses.'
            : 'Foram usadas as entradas cadastradas em cada mês.';

    const card = document.createElement('article');
    card.className = `guget-assistant-result is-${analise.nivel}`;
    card.innerHTML = `
        <div class="guget-assistant-result-head">
            <span class="guget-assistant-result-icon"><i class="fi ${assistantIconeResultado(analise.nivel)}" aria-hidden="true"></i></span>
            <div>
                <h4>${assistantEscaparHtml(analise.titulo)}</h4>
                <p>${assistantEscaparHtml(analise.descricao)}</p>
            </div>
        </div>
        <div class="guget-assistant-result-grid">
            <div>
                <small>Impacto</small>
                <strong>${assistantEscaparHtml(impacto)}</strong>
            </div>
            <div>
                <small>Mês mais apertado</small>
                <strong>${assistantEscaparHtml(mesApertado)}</strong>
            </div>
            <div>
                <small>Comprometimento</small>
                <strong>${assistantEscaparHtml(comprometimento)}</strong>
            </div>
        </div>
        <div class="guget-assistant-result-timeline">
            ${mesesVisiveis.map(item => `
                <div class="guget-assistant-result-month">
                    <span>${assistantEscaparHtml(assistantMes(item.referencia, true))} · saldo previsto</span>
                    <strong>${Number.isFinite(item.saldoDepois) ? assistantEscaparHtml(assistantMoeda(item.saldoDepois)) : 'Sem renda cadastrada'}</strong>
                </div>
            `).join('')}
            ${restantes ? `<div class="guget-assistant-result-month"><span>+ ${restantes} ${restantes === 1 ? 'mês afetado' : 'meses afetados'}</span><strong>até ${assistantEscaparHtml(assistantMes(analise.ultima, true))}</strong></div>` : ''}
        </div>
        <p class="guget-assistant-result-note">${assistantEscaparHtml(origemRenda + cartaoSemLimite)} Esta é uma simulação, não uma compra cadastrada.</p>
    `;
    chat.appendChild(card);
    assistantRolagemFinal();

    return saldoApertado;
}

function assistantExecutarAnalise() {
    const forma = {
        credito: 'no crédito',
        debito: 'no débito',
        pix: 'no Pix',
        dinheiro: 'em dinheiro'
    }[gugetAssistantState.pagamento] || '';
    const parcelas = gugetAssistantState.pagamento === 'credito'
        ? ` em ${gugetAssistantState.parcelas}x${gugetAssistantState.cartao ? ` no ${assistantEscaparHtml(gugetAssistantState.cartao)}` : ''}`
        : '';

    assistantPerguntar(`
        <p>Analisei a compra de <strong class="guget-assistant-money">${assistantMoeda(gugetAssistantState.valor)}</strong> ${forma}${parcelas}.</p>
        <p>Considerei as entradas, os gastos e os compromissos que já estão cadastrados.</p>
    `, [], 'analisando', 'Calculando...', 480);

    const ciclo = gugetAssistantState.ciclo;
    window.setTimeout(() => {
        if (ciclo !== gugetAssistantState.ciclo) return;
        const analise = assistantAnalisarCompra();
        assistantAdicionarResultado(analise);
        gugetAssistantState.etapa = 'resultado';
        assistantDefinirOpcoes([
            { rotulo: 'Nova simulação', valor: 'iniciar' },
            { rotulo: 'Encerrar', valor: 'encerrar', secundaria: true }
        ]);
        assistantDefinirPlaceholder('Digite "nova simulação"...');
        assistantDefinirProcessando(false);
    }, 560);
}

function assistantReceberResposta(valorOriginal, rotuloVisivel = '') {
    if (gugetAssistantState.processando) return;
    const valor = String(valorOriginal || '').trim();
    const normalizado = assistantNormalizar(valor);
    if (!valor) return;

    if (normalizado === 'fechar') {
        fecharAssistente();
        return;
    }

    const mensagemUsuario = assistantAdicionarMensagem('user', rotuloVisivel || valor);
    if (gugetAssistantState.etapa === 'valor') {
        mensagemUsuario?.querySelector('.guget-assistant-bubble')?.classList.add('guget-assistant-money');
    }
    assistantDefinirOpcoes([]);

    if (/^(cancelar|cancela|parar|sair|encerrar|agora nao|nao)$/.test(normalizado)) {
        assistantCancelar();
        return;
    }

    if (/^(iniciar|simular|simular uma compra|nova simulacao|comecar|vamos)$/.test(normalizado)) {
        assistantPerguntarValor();
        return;
    }

    if (gugetAssistantState.etapa === 'valor') {
        const valorCompra = assistantInterpretarValor(valor);
        if (!(valorCompra > 0) || valorCompra > 100000000) {
            if (assistantParecePerguntaLivre(valor)) {
                assistantMensagemEmTreinamento();
            } else {
                assistantPerguntar('<p>Não consegui entender esse valor. Tente digitar assim: <strong>R$ 850,00</strong>.</p>', [
                    { rotulo: 'Cancelar', valor: 'cancelar', secundaria: true }
                ], 'valor', 'Ex: R$ 850,00');
            }
            return;
        }
        gugetAssistantState.valor = valorCompra;
        assistantPerguntarPagamento();
        return;
    }

    if (gugetAssistantState.etapa === 'pagamento') {
        const pagamento = assistantInterpretarPagamento(valor);
        if (!pagamento) {
            if (assistantParecePerguntaLivre(valor)) {
                assistantMensagemEmTreinamento();
            } else {
                assistantPerguntar('<p>Escolha uma destas formas para eu continuar: <strong>crédito, débito, Pix ou dinheiro</strong>.</p>', [
                    { rotulo: 'Crédito', valor: 'credito' },
                    { rotulo: 'Débito', valor: 'debito' },
                    { rotulo: 'Pix', valor: 'pix' },
                    { rotulo: 'Dinheiro', valor: 'dinheiro' },
                    { rotulo: 'Cancelar', valor: 'cancelar', secundaria: true }
                ], 'pagamento', 'Escolha a forma de pagamento');
            }
            return;
        }
        gugetAssistantState.pagamento = pagamento;
        if (pagamento === 'credito') {
            assistantPerguntarParcelas();
        } else {
            gugetAssistantState.parcelas = 1;
            assistantExecutarAnalise();
        }
        return;
    }

    if (gugetAssistantState.etapa === 'parcelas') {
        const parcelas = assistantInterpretarParcelas(valor);
        if (!parcelas) {
            if (assistantParecePerguntaLivre(valor)) {
                assistantMensagemEmTreinamento();
            } else {
                assistantPerguntar('<p>Digite uma quantidade entre <strong>1x e 36x</strong> para eu calcular as parcelas.</p>', [
                    { rotulo: '3x', valor: '3' },
                    { rotulo: '6x', valor: '6' },
                    { rotulo: '12x', valor: '12' },
                    { rotulo: 'Cancelar', valor: 'cancelar', secundaria: true }
                ], 'parcelas', 'Ex: 8x');
            }
            return;
        }
        gugetAssistantState.parcelas = parcelas;
        assistantPerguntarCartao();
        return;
    }

    if (gugetAssistantState.etapa === 'cartao') {
        const cartao = assistantEncontrarCartao(valor);
        if (!cartao) {
            if (assistantParecePerguntaLivre(valor)) {
                assistantMensagemEmTreinamento();
            } else {
                assistantPerguntar('<p>Não encontrei esse cartão na sua carteira. Escolha um dos cartões cadastrados abaixo.</p>', [
                    ...assistantCartoesCredito().map(item => ({ rotulo: item.nome, valor: item.nome })),
                    { rotulo: 'Cancelar', valor: 'cancelar', secundaria: true }
                ], 'cartao', 'Digite ou escolha o cartão');
            }
            return;
        }
        gugetAssistantState.cartao = cartao.nome;
        assistantExecutarAnalise();
        return;
    }

    if (gugetAssistantState.etapa === 'cartao-ausente') {
        if (/sem cartao|simular assim|simular|continuar|sim|pode/.test(normalizado)) {
            gugetAssistantState.cartao = '';
            assistantExecutarAnalise();
        } else {
            assistantMensagemEmTreinamento();
        }
        return;
    }

    assistantMensagemEmTreinamento();
}

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modal-assistente');
    modal?.addEventListener('click', event => {
        if (event.target === modal) fecharAssistente();
    });
    modal?.addEventListener('cancel', event => {
        event.preventDefault();
        fecharAssistente();
    });
});
