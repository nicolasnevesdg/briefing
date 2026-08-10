/* ========================================================= */
/* DÍVIDAS MANUAIS - OBRIGAÇÃO, AGENDA E PAGAMENTOS          */
/* ========================================================= */

function garantirEstruturaDividasManuais() {
    if (!salsiData || typeof salsiData !== 'object') return [];
    if (!Array.isArray(salsiData.dividasManuais)) salsiData.dividasManuais = [];

    salsiData.dividasManuais.forEach(divida => {
        divida.parcelas = Math.max(1, Number(divida.parcelas || 1));
        divida.valorTotal = Number(divida.valorTotal || divida.valor || 0);
        divida.valorParcela = Number(divida.valorParcela || (divida.valorTotal / divida.parcelas) || 0);
        if (!Array.isArray(divida.agenda) || !divida.agenda.length) {
            divida.agenda = criarAgendaDividaManual(divida);
        }
        divida.agenda.forEach((parcela, index) => {
            parcela.numero = Number(parcela.numero || index + 1);
            parcela.valorPrevisto = Number(parcela.valorPrevisto || divida.valorParcela || 0);
            if (!Array.isArray(parcela.pagamentos)) parcela.pagamentos = [];
        });
    });

    return salsiData.dividasManuais;
}

function gerarIdDividaManual(prefixo = 'divida') {
    return `${prefixo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function dataLocalDivida(dataString) {
    if (!dataString) return null;
    const data = new Date(`${dataString}T12:00:00`);
    return Number.isNaN(data.getTime()) ? null : data;
}

function dataIsoLocalDivida(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function adicionarPeriodoDivida(dataBase, indice, periodicidade = 'mensal') {
    const data = new Date(dataBase.getTime());

    if (periodicidade === 'semanal' || periodicidade === 'quinzenal') {
        data.setDate(data.getDate() + indice * (periodicidade === 'semanal' ? 7 : 15));
        return data;
    }

    const diaOriginal = data.getDate();
    const primeiroDoMesAlvo = new Date(data.getFullYear(), data.getMonth() + indice, 1, 12);
    const ultimoDiaAlvo = new Date(primeiroDoMesAlvo.getFullYear(), primeiroDoMesAlvo.getMonth() + 1, 0).getDate();
    primeiroDoMesAlvo.setDate(Math.min(diaOriginal, ultimoDiaAlvo));
    return primeiroDoMesAlvo;
}

function criarAgendaDividaManual(dados, agendaAnterior = []) {
    const parcelas = Math.max(1, Number(dados.parcelas || 1));
    const valorTotalCentavos = Math.round(Number(dados.valorTotal || 0) * 100);
    const valorBaseCentavos = Math.floor(valorTotalCentavos / parcelas);
    const primeiroVencimento = dataLocalDivida(dados.primeiroVencimento) || new Date();
    const periodicidade = dados.periodicidade || 'mensal';

    return Array.from({ length: parcelas }).map((_, index) => {
        const anterior = agendaAnterior[index] || {};
        const valorCentavos = index === parcelas - 1
            ? valorTotalCentavos - (valorBaseCentavos * (parcelas - 1))
            : valorBaseCentavos;

        return {
            numero: index + 1,
            vencimento: dataIsoLocalDivida(adicionarPeriodoDivida(primeiroVencimento, index, periodicidade)),
            valorPrevisto: valorCentavos / 100,
            pagamentos: Array.isArray(anterior.pagamentos) ? anterior.pagamentos : []
        };
    });
}

function obterValorPagoParcelaDivida(parcela) {
    return (parcela?.pagamentos || []).reduce((total, pagamento) => total + Number(pagamento.valor || 0), 0);
}

function obterRestanteParcelaDivida(parcela) {
    return Math.max(0, Number(parcela?.valorPrevisto || 0) - obterValorPagoParcelaDivida(parcela));
}

function obterRestanteDividaManual(divida) {
    return (divida?.agenda || []).reduce((total, parcela) => total + obterRestanteParcelaDivida(parcela), 0);
}

function obterPagoDividaManual(divida) {
    return (divida?.agenda || []).reduce((total, parcela) => total + obterValorPagoParcelaDivida(parcela), 0);
}

function obterStatusParcelaDivida(parcela, agora = new Date()) {
    const restante = obterRestanteParcelaDivida(parcela);
    const pago = obterValorPagoParcelaDivida(parcela);
    if (restante <= 0.005) return 'paga';

    const vencimento = dataLocalDivida(parcela?.vencimento);
    if (!vencimento) return 'futura';

    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12);
    const diferencaDias = Math.ceil((vencimento - hoje) / 86400000);
    if (diferencaDias < 0) return 'vencida';
    if (pago > 0) return 'parcial';
    if (diferencaDias <= 5) return 'em-breve';
    return 'futura';
}

function obterProximaParcelaDivida(divida) {
    return (divida?.agenda || []).find(parcela => obterRestanteParcelaDivida(parcela) > 0.005) || null;
}

function obterResumoDividasManuais() {
    const dividas = garantirEstruturaDividasManuais();
    const hoje = new Date();
    let totalAberto = 0;
    let venceMes = 0;
    let atrasado = 0;

    dividas.forEach(divida => {
        (divida.agenda || []).forEach(parcela => {
            const restante = obterRestanteParcelaDivida(parcela);
            if (restante <= 0.005) return;
            totalAberto += restante;

            const vencimento = dataLocalDivida(parcela.vencimento);
            if (!vencimento) return;
            if (vencimento.getMonth() === hoje.getMonth() && vencimento.getFullYear() === hoje.getFullYear()) {
                venceMes += restante;
            }
            if (obterStatusParcelaDivida(parcela, hoje) === 'vencida') atrasado += restante;
        });
    });

    return { totalAberto, venceMes, atrasado };
}

function persistirDividasManuais() {
    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
    if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
}

function atualizarCamposDividaManual() {
    const forma = document.getElementById('divida-forma')?.value || 'parcelado';
    const parcelado = forma === 'parcelado';
    const campoParcelas = document.getElementById('divida-campo-parcelas');
    const campoPagas = document.getElementById('divida-campo-pagas');
    const inputParcelas = document.getElementById('divida-parcelas');
    const inputPagas = document.getElementById('divida-parcelas-pagas');

    if (campoParcelas) campoParcelas.style.display = parcelado ? '' : 'none';
    if (campoPagas) campoPagas.style.display = parcelado ? '' : 'none';
    if (!parcelado && inputParcelas) inputParcelas.value = 1;
    if (!parcelado && inputPagas) inputPagas.value = 0;
}

function abrirModalDividaManual(id = '') {
    garantirEstruturaDividasManuais();
    const divida = id ? salsiData.dividasManuais.find(item => String(item.id) === String(id)) : null;
    const modal = document.getElementById('modal-divida-manual');
    if (!modal) return;

    const hoje = new Date();
    const vencimentoPadrao = dataIsoLocalDivida(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7, 12));
    document.getElementById('divida-id').value = divida?.id || '';
    document.getElementById('modal-divida-title').textContent = divida ? 'Editar dívida' : 'Nova dívida';
    document.getElementById('divida-credor').value = divida?.credor || '';
    document.getElementById('divida-nome').value = divida?.nome || '';
    document.getElementById('divida-tipo').value = divida?.tipo || 'cartao-terceiro';
    document.getElementById('divida-valor-total').value = divida ? valorParaCampoMoeda(divida.valorTotal) : '';
    document.getElementById('divida-forma').value = divida?.formaPagamento || 'parcelado';
    document.getElementById('divida-parcelas').value = divida?.parcelas || 2;
    document.getElementById('divida-parcelas-pagas').value = divida
        ? (divida.agenda || []).filter(parcela => obterRestanteParcelaDivida(parcela) <= 0.005).length
        : 0;
    document.getElementById('divida-parcelas-pagas').disabled = !!divida;
    document.getElementById('divida-primeiro-vencimento').value = divida?.primeiroVencimento || vencimentoPadrao;
    document.getElementById('divida-periodicidade').value = divida?.periodicidade || 'mensal';
    document.getElementById('divida-observacao').value = divida?.observacao || '';

    atualizarCamposDividaManual();
    modal.showModal();
}

function salvarDividaManual() {
    const dividas = garantirEstruturaDividasManuais();
    const id = document.getElementById('divida-id').value;
    const existente = id ? dividas.find(item => String(item.id) === String(id)) : null;
    const credor = document.getElementById('divida-credor').value.trim();
    const nome = document.getElementById('divida-nome').value.trim();
    const valorTotal = parseValorMonetarioInput(document.getElementById('divida-valor-total').value);
    const formaPagamento = document.getElementById('divida-forma').value;
    const parcelas = formaPagamento === 'unico'
        ? 1
        : Math.max(1, Number(document.getElementById('divida-parcelas').value || 1));
    const parcelasPagas = formaPagamento === 'unico'
        ? 0
        : Math.max(0, Math.min(parcelas, Number(document.getElementById('divida-parcelas-pagas').value || 0)));
    const primeiroVencimento = document.getElementById('divida-primeiro-vencimento').value;

    if (!credor || !nome || valorTotal <= 0 || !primeiroVencimento) {
        alert('Preencha para quem você deve, a descrição, o valor e o primeiro vencimento.');
        return;
    }

    if (existente) {
        const totalJaPago = obterPagoDividaManual(existente);
        const parcelasComPagamento = (existente.agenda || []).filter(parcela => obterValorPagoParcelaDivida(parcela) > 0).length;
        if (valorTotal + 0.005 < totalJaPago) {
            alert('O valor total não pode ser menor que o valor que já foi pago.');
            return;
        }
        if (parcelas < parcelasComPagamento) {
            alert('A quantidade de parcelas não pode ser menor que o número de parcelas que já receberam pagamentos.');
            return;
        }
    }

    const dados = {
        id: existente?.id || gerarIdDividaManual(),
        origem: 'manual',
        credor,
        nome,
        tipo: document.getElementById('divida-tipo').value,
        valorTotal,
        formaPagamento,
        parcelas,
        valorParcela: valorTotal / parcelas,
        primeiroVencimento,
        periodicidade: document.getElementById('divida-periodicidade').value,
        observacao: document.getElementById('divida-observacao').value.trim(),
        criadoEm: existente?.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    };

    dados.agenda = criarAgendaDividaManual(dados, existente?.agenda || []);

    if (!existente && parcelasPagas > 0) {
        dados.agenda.slice(0, parcelasPagas).forEach(parcela => {
            parcela.pagamentos.push({
                id: gerarIdDividaManual('historico'),
                valor: parcela.valorPrevisto,
                data: parcela.vencimento,
                forma: 'Histórico anterior',
                conta: '',
                observacao: 'Parcela informada como paga no cadastro inicial.',
                historico: true
            });
        });
    }

    if (existente) {
        dividas[dividas.indexOf(existente)] = dados;
    } else {
        dividas.push(dados);
    }

    persistirDividasManuais();
    document.getElementById('modal-divida-manual').close();
    if (typeof renderizarVisualizacoes === 'function') renderizarVisualizacoes();
    if (document.querySelector('main')?.classList.contains('calendar-mode') && typeof renderizarCalendarioFinanceiro === 'function') {
        renderizarCalendarioFinanceiro(window.calendarioMesAtual ?? new Date().getMonth(), window.calendarioAnoAtual ?? new Date().getFullYear());
    }
    if (typeof mostrarToast === 'function') mostrarToast(existente ? 'Dívida atualizada.' : 'Dívida adicionada ao planejamento.');
}

function apagarDividaManual(id) {
    const dividas = garantirEstruturaDividasManuais();
    const divida = dividas.find(item => String(item.id) === String(id));
    if (!divida) return;

    const aviso = obterPagoDividaManual(divida) > 0
        ? 'Os gastos que já foram gerados pelos pagamentos continuarão no histórico. Deseja apagar esta dívida?'
        : 'Deseja apagar esta dívida do planejamento?';
    if (!confirm(aviso)) return;

    salsiData.dividasManuais = dividas.filter(item => String(item.id) !== String(id));
    persistirDividasManuais();
    if (typeof renderizarVisualizacoes === 'function') renderizarVisualizacoes();
    if (typeof mostrarToast === 'function') mostrarToast('Dívida removida.');
}

function preencherContasPagamentoDivida() {
    const datalist = document.getElementById('pagamento-divida-contas');
    if (!datalist) return;
    const config = salsiData?.config || {};
    const nomes = [];

    (config.bancos || []).forEach(item => nomes.push(typeof item === 'string' ? item : (item?.nome || item?.banco || '')));
    (config.detalhesBancos || []).forEach(item => nomes.push(typeof item === 'string' ? item : (item?.nome || item?.banco || '')));
    datalist.innerHTML = [...new Set(nomes.filter(Boolean))]
        .map(nome => `<option value="${escaparHtmlCarteira(nome)}"></option>`)
        .join('');
}

function abrirPagamentoDividaManual(id, numeroParcela = null) {
    const divida = garantirEstruturaDividasManuais().find(item => String(item.id) === String(id));
    if (!divida) return;
    const parcela = numeroParcela
        ? divida.agenda.find(item => Number(item.numero) === Number(numeroParcela))
        : obterProximaParcelaDivida(divida);
    if (!parcela || obterRestanteDividaManual(divida) <= 0.005) {
        if (typeof mostrarToast === 'function') mostrarToast('Esta dívida já está quitada.');
        return;
    }

    document.getElementById('pagamento-divida-id').value = divida.id;
    document.getElementById('pagamento-divida-parcela').value = parcela.numero;
    document.getElementById('pagamento-divida-title').textContent = `${divida.nome} · parcela ${parcela.numero}/${divida.parcelas}`;
    document.getElementById('pagamento-divida-resumo').textContent = `Para ${divida.credor} · vence em ${dataVisual(parcela.vencimento)} · falta ${moedaVisual(obterRestanteParcelaDivida(parcela))}`;
    document.getElementById('pagamento-divida-valor').value = valorParaCampoMoeda(obterRestanteParcelaDivida(parcela));
    document.getElementById('pagamento-divida-data').value = dataIsoLocalDivida(new Date());
    document.getElementById('pagamento-divida-forma').value = 'PIX';
    document.getElementById('pagamento-divida-conta').value = '';
    document.getElementById('pagamento-divida-observacao').value = '';
    preencherContasPagamentoDivida();
    document.getElementById('modal-pagamento-divida').showModal();
}

async function salvarPagamentoDividaManual() {
    const id = document.getElementById('pagamento-divida-id').value;
    const numeroParcela = Number(document.getElementById('pagamento-divida-parcela').value || 0);
    const divida = garantirEstruturaDividasManuais().find(item => String(item.id) === String(id));
    if (!divida) return;

    const valor = parseValorMonetarioInput(document.getElementById('pagamento-divida-valor').value);
    const data = document.getElementById('pagamento-divida-data').value;
    const forma = document.getElementById('pagamento-divida-forma').value;
    const conta = document.getElementById('pagamento-divida-conta').value.trim();
    const observacao = document.getElementById('pagamento-divida-observacao').value.trim();
    const restanteDivida = obterRestanteDividaManual(divida);

    if (valor <= 0 || !data) {
        alert('Informe um valor e uma data válidos.');
        return;
    }
    if (valor > restanteDivida + 0.005) {
        alert(`O pagamento não pode ultrapassar o saldo da dívida (${moedaVisual(restanteDivida)}).`);
        return;
    }

    const indiceInicial = Math.max(0, divida.agenda.findIndex(parcela => Number(parcela.numero) === numeroParcela));
    const ordem = [...divida.agenda.slice(indiceInicial), ...divida.agenda.slice(0, indiceInicial)]
        .filter(parcela => obterRestanteParcelaDivida(parcela) > 0.005);
    const pagamentoId = gerarIdDividaManual('pagamento');
    let saldoParaDistribuir = valor;
    const parcelasAfetadas = [];

    ordem.forEach(parcela => {
        if (saldoParaDistribuir <= 0.005) return;
        const alocado = Math.min(obterRestanteParcelaDivida(parcela), saldoParaDistribuir);
        parcela.pagamentos.push({
            id: pagamentoId,
            valor: Number(alocado.toFixed(2)),
            data,
            forma,
            conta,
            observacao,
            criadoEm: new Date().toISOString()
        });
        parcelasAfetadas.push(parcela.numero);
        saldoParaDistribuir = Number((saldoParaDistribuir - alocado).toFixed(2));
    });

    const agora = Date.now();
    salsiData.transacoes.push({
        nome: `Dívida - ${divida.nome}`,
        tipo: 'debito',
        valorTotal: valor,
        valorParcela: valor,
        parcelas: 1,
        dataCompra: data,
        banco: conta || forma,
        categoria: 'Dívidas',
        observacao: observacao || `Pagamento para ${divida.credor}. Parcela${parcelasAfetadas.length > 1 ? 's' : ''} ${parcelasAfetadas.join(', ')} de ${divida.parcelas}.`,
        pago: true,
        delayPagamento: 0,
        eDeTerceiro: false,
        nomeTerceiro: '',
        terceiro: null,
        formaPagamento: forma,
        comprovanteUrl: '',
        origemDividaManual: true,
        dividaManualId: divida.id,
        pagamentoDividaId: pagamentoId,
        parcelasDivida: parcelasAfetadas,
        criadoEm: agora,
        destaqueAte: agora + (24 * 60 * 60 * 1000)
    });

    divida.atualizadoEm = new Date().toISOString();
    if (obterRestanteDividaManual(divida) <= 0.005) divida.quitadaEm = data;

    document.getElementById('modal-pagamento-divida').close();
    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
    if (typeof salvarNoFirebase === 'function') await salvarNoFirebase();
    if (typeof renderizar === 'function') renderizar();
    if (typeof renderizarVisualizacoes === 'function') renderizarVisualizacoes();
    if (typeof mostrarToast === 'function') mostrarToast('Pagamento registrado como gasto.');
}

function classeStatusDividaManual(status) {
    if (status === 'vencida') return 'danger';
    if (status === 'em-breve' || status === 'parcial') return 'warn';
    if (status === 'paga') return '';
    return 'muted';
}

function labelStatusDividaManual(status) {
    const labels = {
        vencida: 'Vencida',
        'em-breve': 'Vence em breve',
        parcial: 'Pagamento parcial',
        paga: 'Paga',
        futura: 'A vencer'
    };
    return labels[status] || 'A vencer';
}

function renderizarOverviewDividasManuais(resumo) {
    const alvo = document.getElementById('visual-dividas-overview');
    if (!alvo) return;
    alvo.innerHTML = `
        <div class="dividas-radar-card is-primary">
            <span>Total em aberto</span>
            <strong>${moedaVisual(resumo.totalAberto)}</strong>
            <small>Dívidas manuais e recebidas ainda não quitadas</small>
        </div>
        <div class="dividas-radar-card">
            <span>Vence neste mês</span>
            <strong>${moedaVisual(resumo.venceMes)}</strong>
            <small>Parcelas com vencimento no mês atual</small>
        </div>
        <div class="dividas-radar-card ${resumo.atrasado > 0 ? 'has-danger' : ''}">
            <span>Total atrasado</span>
            <strong>${moedaVisual(resumo.atrasado)}</strong>
            <small>${resumo.atrasado > 0 ? 'Existem pagamentos que precisam de atenção' : 'Nenhuma parcela vencida'}</small>
        </div>
    `;
}

function cardDividaManual(divida) {
    const restante = obterRestanteDividaManual(divida);
    const proxima = obterProximaParcelaDivida(divida);
    const quitada = restante <= 0.005;
    const status = quitada ? 'paga' : obterStatusParcelaDivida(proxima);
    const pago = obterPagoDividaManual(divida);
    const progresso = divida.valorTotal > 0 ? Math.min(100, Math.round((pago / divida.valorTotal) * 100)) : 0;
    const valorProxima = proxima ? obterRestanteParcelaDivida(proxima) : 0;

    return `
        <div class="visual-card divida-manual-card ${status === 'vencida' ? 'is-overdue' : ''}" id="divida-card-${divida.id}">
            <div class="visual-card-main">
                <span class="visual-item-kicker">Dívida manual · Para ${escaparHtmlCarteira(divida.credor || 'Credor')}</span>
                <div class="visual-card-title">
                    <span>${escaparHtmlCarteira(divida.nome || 'Dívida')}</span>
                    <small class="visual-badge ${classeStatusDividaManual(status)}">${labelStatusDividaManual(status)}</small>
                </div>
                <div class="visual-card-meta divida-meta-grid">
                    <span class="parcelado-meta-chip"><small>Parcela</small><strong>${proxima ? `${proxima.numero}/${divida.parcelas}` : `${divida.parcelas}/${divida.parcelas}`}</strong></span>
                    <span class="parcelado-meta-chip"><small>Próximo valor</small><strong>${moedaVisual(valorProxima)}</strong></span>
                    <span class="parcelado-meta-chip"><small>Vencimento</small><strong>${proxima ? dataVisual(proxima.vencimento) : 'Quitada'}</strong></span>
                    <span class="parcelado-meta-chip"><small>Já pago</small><strong>${moedaVisual(pago)}</strong></span>
                </div>
                ${divida.observacao ? `<p class="divida-card-note">${escaparHtmlCarteira(divida.observacao)}</p>` : ''}
            </div>
            <div class="visual-card-value">
                <span class="parcelado-value-label">Ainda falta</span>
                <strong>${moedaVisual(restante)}</strong>
                <div class="visual-progress" title="${progresso}% quitado"><span style="width:${progresso}%"></span></div>
                <div class="visual-card-actions">
                    <button type="button" class="visual-mini-btn danger" onclick="apagarDividaManual('${divida.id}')">Excluir</button>
                    <button type="button" class="visual-mini-btn" onclick="abrirModalDividaManual('${divida.id}')">Editar</button>
                    ${proxima ? `<button type="button" class="visual-mini-btn primary" onclick="abrirPagamentoDividaManual('${divida.id}', ${proxima.numero})">Registrar pagamento</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

function cardDividaRecebidaGuget(item, tipo) {
    const status = item.status || 'pendente';
    const statusLabel = labelStatusCompartilhado(status);
    const statusClass = classeStatusCompartilhado(status);
    const acoes = tipo === 'pendente'
        ? `
            <button type="button" class="visual-mini-btn danger" onclick="apagarDividaRecebida('${item.id}')">Apagar</button>
            <button type="button" class="visual-mini-btn" onclick="responderSolicitacaoGasto('${item.id}', 'contestado')">Contestar</button>
            <button type="button" class="visual-mini-btn primary" onclick="responderSolicitacaoGasto('${item.id}', 'aceito')">Aceitar</button>
        `
        : tipo === 'aceita'
            ? `
                <button type="button" class="visual-mini-btn danger" onclick="apagarDividaRecebida('${item.id}')">Apagar</button>
                <button type="button" class="visual-mini-btn primary" onclick="abrirPagamentoDivida('${item.id}')">Pagar</button>
            `
            : `<button type="button" class="visual-mini-btn danger" onclick="apagarDividaRecebida('${item.id}')">Apagar</button>`;

    return `
        <div class="visual-card divida-recebida-card">
            <div class="visual-card-main">
                <span class="visual-item-kicker">Recebida de ${escaparHtmlCarteira(item.enviadoPorNome || 'Usuário')}</span>
                <div class="visual-card-title">
                    <span>${escaparHtmlCarteira(item.nome || 'Dívida')}</span>
                    <small class="visual-badge ${statusClass}">${statusLabel}</small>
                </div>
                <div class="visual-card-meta">
                    <span>${dataVisual(item.dataCompra)}</span>
                    <span>${escaparHtmlCarteira(item.categoria || 'Sem categoria')}</span>
                    <span>${Number(item.parcelas || 1)}x de ${moedaVisual(item.valorParcela || item.valor || 0)}</span>
                    ${item.observacao ? `<span>${escaparHtmlCarteira(item.observacao)}</span>` : ''}
                </div>
            </div>
            <div class="visual-card-value">
                <strong>${moedaVisual(item.valor || 0)}</strong>
                <div class="visual-card-actions">${acoes}</div>
            </div>
        </div>
    `;
}

async function renderizarVisualDividas() {
    const lista = document.getElementById('visual-lista-dividas');
    const resumoHeader = document.getElementById('visual-dividas-pendentes');
    if (!lista) return;

    const manuais = garantirEstruturaDividasManuais();
    const resumo = obterResumoDividasManuais();
    renderizarOverviewDividasManuais(resumo);
    lista.innerHTML = '<div class="visual-empty">Atualizando suas dívidas...</div>';

    const recebidas = typeof renderizarSolicitacoesRecebidas === 'function'
        ? await renderizarSolicitacoesRecebidas()
        : [];
    dividasRecebidasCache = {};
    recebidas.forEach(item => { dividasRecebidasCache[item.id] = item; });

    const pendentesRecebidas = recebidas.filter(item => (item.status || 'pendente') === 'pendente');
    const aceitasRecebidas = recebidas.filter(item => item.status === 'aceito');
    const contestadasRecebidas = recebidas.filter(item => item.status === 'contestado');
    const pagasRecebidas = recebidas.filter(item => item.status === 'pago');
    const totalRecebidoAberto = [...pendentesRecebidas, ...aceitasRecebidas]
        .reduce((total, item) => total + Number(item.valor || 0), 0);
    renderizarOverviewDividasManuais({ ...resumo, totalAberto: resumo.totalAberto + totalRecebidoAberto });
    if (resumoHeader) resumoHeader.textContent = moedaVisual(resumo.totalAberto + totalRecebidoAberto);

    const grupos = { vencidas: [], breve: [], proximas: [], quitadas: [] };
    manuais.forEach(divida => {
        const proxima = obterProximaParcelaDivida(divida);
        if (!proxima) grupos.quitadas.push(divida);
        else {
            const status = obterStatusParcelaDivida(proxima);
            if (status === 'vencida') grupos.vencidas.push(divida);
            else if (status === 'em-breve' || status === 'parcial') grupos.breve.push(divida);
            else grupos.proximas.push(divida);
        }
    });

    const ordenarPorVencimento = (a, b) => {
        const dataA = dataLocalDivida(obterProximaParcelaDivida(a)?.vencimento)?.getTime() || Infinity;
        const dataB = dataLocalDivida(obterProximaParcelaDivida(b)?.vencimento)?.getTime() || Infinity;
        return dataA - dataB;
    };
    grupos.vencidas.sort(ordenarPorVencimento);
    grupos.breve.sort(ordenarPorVencimento);
    grupos.proximas.sort(ordenarPorVencimento);

    const recebidasAtivas = [...pendentesRecebidas, ...aceitasRecebidas, ...contestadasRecebidas];
    const html = [
        grupos.vencidas.length ? `<div class="visual-section-label is-danger">Vencidas</div>${grupos.vencidas.map(cardDividaManual).join('')}` : '',
        grupos.breve.length ? `<div class="visual-section-label">Vencem em breve</div>${grupos.breve.map(cardDividaManual).join('')}` : '',
        grupos.proximas.length ? `<div class="visual-section-label">Próximas</div>${grupos.proximas.map(cardDividaManual).join('')}` : '',
        recebidasAtivas.length ? `<div class="visual-section-label">Recebidas pelo GugetFin</div>${[
            ...pendentesRecebidas.map(item => cardDividaRecebidaGuget(item, 'pendente')),
            ...aceitasRecebidas.map(item => cardDividaRecebidaGuget(item, 'aceita')),
            ...contestadasRecebidas.map(item => cardDividaRecebidaGuget(item, 'historico'))
        ].join('')}` : '',
        (grupos.quitadas.length || pagasRecebidas.length) ? `<div class="visual-section-label">Quitadas</div>${[
            ...grupos.quitadas.map(cardDividaManual),
            ...pagasRecebidas.map(item => cardDividaRecebidaGuget(item, 'historico'))
        ].join('')}` : ''
    ].join('');

    lista.innerHTML = html || '<div class="visual-empty">Nenhuma dívida cadastrada. Use “Nova dívida” para planejar um compromisso futuro.</div>';
}

function abrirDividaPeloParcelado(id) {
    if (typeof selecionarAbaVisualizacoes === 'function') selecionarAbaVisualizacoes('dividas');
    setTimeout(() => document.getElementById(`divida-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
}

function reverterPagamentoDividaManualPorGasto(gasto) {
    if (!gasto?.origemDividaManual || !gasto.pagamentoDividaId) return;
    const divida = garantirEstruturaDividasManuais()
        .find(item => String(item.id) === String(gasto.dividaManualId));
    if (!divida) return;

    (divida.agenda || []).forEach(parcela => {
        parcela.pagamentos = (parcela.pagamentos || [])
            .filter(pagamento => String(pagamento.id) !== String(gasto.pagamentoDividaId));
    });
    delete divida.quitadaEm;
    divida.atualizadoEm = new Date().toISOString();
}

/* ========================================================= */
/* DASHBOARD - COMPROMISSOS E RESERVAS                       */
/* ========================================================= */

let dashboardDividasRecebidas = [];
let dashboardDividasRecebidasEm = 0;
let dashboardDividasRecebidasPromise = null;

function abrirDetalhesCompromissosDashboard(aba = 'dividas') {
    if (window.innerWidth <= 1024 && typeof irParaVisualizacoesMobile === 'function') {
        irParaVisualizacoesMobile(aba);
        return;
    }
    if (typeof irParaVisualizacoes === 'function') irParaVisualizacoes(aba);
}

function definirTextoResumoDashboard(id, texto) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = texto;
}

function obterMesBaseDashboard() {
    if (typeof dataFiltro !== 'undefined' && dataFiltro instanceof Date) {
        return new Date(dataFiltro.getFullYear(), dataFiltro.getMonth(), 1, 12);
    }
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12);
}

function diferencaMesesDashboard(dataInicial, dataFinal) {
    return (dataFinal.getFullYear() - dataInicial.getFullYear()) * 12
        + (dataFinal.getMonth() - dataInicial.getMonth());
}

function obterResumoTerceirosDashboard() {
    const gastos = (salsiData?.transacoes || [])
        .filter(transacao => transacao.eDeTerceiro && (!transacao.statusCompartilhado || transacao.statusCompartilhado !== 'arquivado'));

    return gastos.reduce((resumo, transacao) => {
        const deveContar = typeof gastoTerceiroContaNoResumo === 'function'
            ? gastoTerceiroContaNoResumo(transacao)
            : !transacao.pago;
        if (!deveContar) return resumo;

        const recebimento = typeof calcularRecebimentoTerceiro === 'function'
            ? calcularRecebimentoTerceiro(transacao)
            : {
                valorPendente: transacao.pago ? 0 : Number(transacao.valorTotal || transacao.valorParcela || 0),
                pendentes: transacao.pago ? 0 : 1
            };
        const valorPendente = Number(recebimento.valorPendente || 0);
        if (valorPendente <= 0.005) return resumo;

        resumo.valor += valorPendente;
        resumo.quantidade += 1;
        return resumo;
    }, { valor: 0, quantidade: 0 });
}

function obterResumoParceladosDashboard(mesBase) {
    let valor = 0;
    let quantidade = 0;

    (salsiData?.transacoes || [])
        .filter(transacao => Number(transacao.parcelas || 1) > 1)
        .forEach(transacao => {
            const inicio = typeof calcularCompetenciaInicialGasto === 'function'
                ? calcularCompetenciaInicialGasto(transacao)
                : dataLocalDivida(transacao.dataCompra);
            if (!inicio) return;

            const diferenca = diferencaMesesDashboard(inicio, mesBase);
            if (diferenca < 0 || diferenca >= Number(transacao.parcelas || 1)) return;
            valor += Number(transacao.valorParcela || transacao.valorTotal || 0);
            quantidade += 1;
        });

    garantirEstruturaDividasManuais().forEach(divida => {
        const parcelasDoMes = (divida.agenda || []).filter(parcela => {
            const vencimento = dataLocalDivida(parcela.vencimento);
            return vencimento
                && vencimento.getMonth() === mesBase.getMonth()
                && vencimento.getFullYear() === mesBase.getFullYear()
                && obterRestanteParcelaDivida(parcela) > 0.005;
        });
        const valorDividaMes = parcelasDoMes.reduce((total, parcela) => total + obterRestanteParcelaDivida(parcela), 0);
        if (valorDividaMes > 0) {
            valor += valorDividaMes;
            quantidade += 1;
        }
    });

    return { valor, quantidade };
}

function obterResumoCaixinhaDashboard(mesBase) {
    if (typeof garantirEstruturaCaixinha === 'function') garantirEstruturaCaixinha();
    const movimentos = Array.isArray(salsiData?.caixinha) ? salsiData.caixinha : [];
    const saldo = typeof calcularSaldoCaixinha === 'function'
        ? calcularSaldoCaixinha()
        : movimentos.reduce((total, movimento) => total + (movimento.tipo === 'saida' ? -Number(movimento.valor || 0) : Number(movimento.valor || 0)), 0);
    const movimentoMes = movimentos.reduce((total, movimento) => {
        const data = dataLocalDivida(movimento.data);
        if (!data || data.getMonth() !== mesBase.getMonth() || data.getFullYear() !== mesBase.getFullYear()) return total;
        return total + (movimento.tipo === 'saida' ? -Number(movimento.valor || 0) : Number(movimento.valor || 0));
    }, 0);

    return { saldo, movimentoMes };
}

function obterResumoDividasDashboard(recebidas = []) {
    const hoje = new Date();
    const dividas = garantirEstruturaDividasManuais();
    let valor = 0;
    let atrasadas = 0;
    let proxima = null;

    dividas.forEach(divida => {
        valor += obterRestanteDividaManual(divida);
        (divida.agenda || []).forEach(parcela => {
            const restante = obterRestanteParcelaDivida(parcela);
            if (restante <= 0.005) return;
            const status = obterStatusParcelaDivida(parcela, hoje);
            if (status === 'vencida') atrasadas += 1;
            const vencimento = dataLocalDivida(parcela.vencimento);
            if (vencimento && (!proxima || vencimento < proxima.vencimento)) {
                proxima = { vencimento, restante, credor: divida.credor || '' };
            }
        });
    });

    const recebidasAbertas = recebidas.filter(item => ['pendente', 'aceito'].includes(item.status || 'pendente'));
    valor += recebidasAbertas.reduce((total, item) => total + Number(item.valor || 0), 0);
    return { valor, atrasadas, proxima, recebidasPendentes: recebidasAbertas.length };
}

function aplicarResumoDividasDashboard(recebidas = dashboardDividasRecebidas) {
    const resumo = obterResumoDividasDashboard(recebidas);
    definirTextoResumoDashboard('dashboard-dividas-valor', moedaVisual(resumo.valor));

    let detalhe = 'Nenhuma dívida em aberto';
    if (resumo.atrasadas > 0) {
        detalhe = `${resumo.atrasadas} parcela${resumo.atrasadas === 1 ? '' : 's'} vencida${resumo.atrasadas === 1 ? '' : 's'} precisa${resumo.atrasadas === 1 ? '' : 'm'} de atenção`;
    } else if (resumo.proxima) {
        detalhe = `Próxima: ${moedaVisual(resumo.proxima.restante)} em ${dataVisual(dataIsoLocalDivida(resumo.proxima.vencimento))}`;
    } else if (resumo.recebidasPendentes > 0) {
        detalhe = `${resumo.recebidasPendentes} solicitação${resumo.recebidasPendentes === 1 ? '' : 'ões'} recebida${resumo.recebidasPendentes === 1 ? '' : 's'}`;
    }
    definirTextoResumoDashboard('dashboard-dividas-detail', detalhe);

    const card = document.querySelector('.dashboard-commitment-card.is-debt');
    if (card) card.classList.toggle('has-alert', resumo.atrasadas > 0);
}

async function carregarDividasRecebidasDashboard() {
    const agora = Date.now();
    if (agora - dashboardDividasRecebidasEm < 60000) return dashboardDividasRecebidas;
    if (dashboardDividasRecebidasPromise) return dashboardDividasRecebidasPromise;
    if (typeof renderizarSolicitacoesRecebidas !== 'function') return [];

    dashboardDividasRecebidasPromise = renderizarSolicitacoesRecebidas()
        .then(itens => {
            dashboardDividasRecebidas = Array.isArray(itens) ? itens : [];
            dashboardDividasRecebidasEm = Date.now();
            return dashboardDividasRecebidas;
        })
        .catch(() => dashboardDividasRecebidas)
        .finally(() => { dashboardDividasRecebidasPromise = null; });

    return dashboardDividasRecebidasPromise;
}

function renderizarResumoCompromissosDashboard() {
    if (!document.getElementById('dashboard-commitments')) return;
    const mesBase = obterMesBaseDashboard();
    const periodo = mesBase.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    definirTextoResumoDashboard('dashboard-commitments-period', `Visão de ${periodo}. Dívidas e terceiros mostram saldos em aberto; parcelados refletem o mês.`);

    const terceiros = obterResumoTerceirosDashboard();
    definirTextoResumoDashboard('dashboard-terceiros-valor', moedaVisual(terceiros.valor));
    definirTextoResumoDashboard(
        'dashboard-terceiros-detail',
        terceiros.quantidade
            ? `${terceiros.quantidade} pagamento${terceiros.quantidade === 1 ? '' : 's'} pendente${terceiros.quantidade === 1 ? '' : 's'}`
            : 'Ninguém está devendo'
    );

    const parcelados = obterResumoParceladosDashboard(mesBase);
    definirTextoResumoDashboard('dashboard-parcelados-valor', moedaVisual(parcelados.valor));
    definirTextoResumoDashboard(
        'dashboard-parcelados-detail',
        parcelados.quantidade
            ? `${parcelados.quantidade} compromisso${parcelados.quantidade === 1 ? '' : 's'} ativo${parcelados.quantidade === 1 ? '' : 's'} no mês`
            : 'Nenhum compromisso neste mês'
    );

    const caixinha = obterResumoCaixinhaDashboard(mesBase);
    definirTextoResumoDashboard('dashboard-caixinha-valor', moedaVisual(caixinha.saldo));
    const quantidadeCaixinhas = Number(caixinha.quantidade || 1);
    const resumoQuantidadeCaixinhas = `${quantidadeCaixinhas} caixinha${quantidadeCaixinhas === 1 ? '' : 's'}`;
    definirTextoResumoDashboard(
        'dashboard-caixinha-detail',
        Math.abs(caixinha.movimentoMes) > 0.005
            ? `${resumoQuantidadeCaixinhas} · ${caixinha.movimentoMes >= 0 ? '+' : '-'} ${moedaVisual(Math.abs(caixinha.movimentoMes))} ${caixinha.movimentoMes >= 0 ? 'guardados' : 'retirados'} no mês`
            : `${resumoQuantidadeCaixinhas} ativa${quantidadeCaixinhas === 1 ? '' : 's'}`
    );

    aplicarResumoDividasDashboard();
    carregarDividasRecebidasDashboard().then(aplicarResumoDividasDashboard);
}
