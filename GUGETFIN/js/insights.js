/* ========================================================= */
/* GUGET INSIGHTS - ANÁLISE LOCAL, SEM SERVIÇOS DE IA       */
/* ========================================================= */

function insightsEscaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[caractere]);
}

function insightsMoeda(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function insightsPercentual(valor) {
    return `${(Number(valor) || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    })}%`;
}

function insightsMes(data, formato = 'long') {
    const texto = data.toLocaleDateString('pt-BR', {
        month: formato,
        year: formato === 'long' ? 'numeric' : undefined
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1).replace('.', '');
}

function insightsAdicionarMes(data, quantidade) {
    return new Date(data.getFullYear(), data.getMonth() + quantidade, 1, 12);
}

function insightsCompetenciaTransacao(transacao) {
    try {
        if (typeof calcularCompetenciaInicialGasto === 'function') {
            const competencia = calcularCompetenciaInicialGasto(transacao);
            if (competencia instanceof Date && !Number.isNaN(competencia.getTime())) {
                return competencia;
            }
            return null;
        }
    } catch (error) {
        // A data original continua sendo um fallback seguro para registros antigos.
    }

    const data = new Date(`${transacao?.dataCompra || ''}T12:00:00`);
    return Number.isNaN(data.getTime()) ? null : new Date(data.getFullYear(), data.getMonth(), 1, 12);
}

function insightsOcorrenciaTransacaoNoMes(transacao, referencia) {
    const inicio = insightsCompetenciaTransacao(transacao);
    if (!inicio) return null;

    const parcelas = Math.max(1, Number(transacao?.parcelas || 1));
    const diferenca = (referencia.getFullYear() - inicio.getFullYear()) * 12
        + (referencia.getMonth() - inicio.getMonth());
    if (diferenca < 0 || diferenca >= parcelas) return null;

    const valorTotal = Number(transacao?.valorTotal || transacao?.valor || 0);
    const valor = transacao?.tipo === 'cartao'
        ? Number(transacao?.valorParcela || (valorTotal / parcelas) || 0)
        : valorTotal;

    return {
        valor: Math.max(0, valor),
        parcela: diferenca + 1,
        parcelas
    };
}

function insightsResumoMes(referencia) {
    const mes = referencia.getMonth();
    const ano = referencia.getFullYear();
    const entradasMes = (Array.isArray(salsiData?.entradas) ? salsiData.entradas : [])
        .filter(entrada => Number(entrada.mes) === mes && Number(entrada.ano) === ano);
    const entradas = entradasMes.reduce((total, entrada) => total + Number(entrada.valor || 0), 0);
    const renda = entradasMes
        .filter(entrada => entrada.tipoEntrada !== 'resgate_caixinha')
        .reduce((total, entrada) => total + Number(entrada.valor || 0), 0);

    const categorias = {};
    const formas = { cartao: 0, debito: 0, fixo: 0 };
    let gastosRealizados = 0;
    let fixosPendentes = 0;
    let quantidade = 0;

    (Array.isArray(salsiData?.transacoes) ? salsiData.transacoes : []).forEach(transacao => {
        if (transacao?.eDeTerceiro) return;
        const ocorrencia = insightsOcorrenciaTransacaoNoMes(transacao, referencia);
        if (!ocorrencia) return;

        const valor = ocorrencia.valor;
        const fixoPendente = transacao.tipo === 'fixo' && transacao.pago !== true;
        if (fixoPendente) {
            fixosPendentes += valor;
            return;
        }

        gastosRealizados += valor;
        quantidade += 1;
        const categoria = String(transacao.categoria || 'Sem categoria').trim() || 'Sem categoria';
        categorias[categoria] = (categorias[categoria] || 0) + valor;

        if (transacao.tipo === 'cartao') formas.cartao += valor;
        else if (transacao.tipo === 'fixo') formas.fixo += valor;
        else formas.debito += valor;
    });

    let dividasPendentes = 0;
    if (typeof garantirEstruturaDividasManuais === 'function') {
        garantirEstruturaDividasManuais().forEach(divida => {
            (divida.agenda || []).forEach(parcela => {
                const vencimento = typeof dataLocalDivida === 'function'
                    ? dataLocalDivida(parcela.vencimento)
                    : new Date(`${parcela.vencimento || ''}T12:00:00`);
                if (!vencimento || Number.isNaN(vencimento.getTime())) return;
                if (vencimento.getMonth() !== mes || vencimento.getFullYear() !== ano) return;

                const restante = typeof obterRestanteParcelaDivida === 'function'
                    ? obterRestanteParcelaDivida(parcela)
                    : Number(parcela.valorPrevisto || 0);
                dividasPendentes += Math.max(0, Number(restante || 0));
            });
        });
    }

    const pendente = fixosPendentes + dividasPendentes;
    const saldo = entradas - gastosRealizados;

    return {
        referencia,
        entradas,
        renda,
        gastos: gastosRealizados,
        saldo,
        previsto: saldo - pendente,
        pendente,
        fixosPendentes,
        dividasPendentes,
        quantidade,
        categorias,
        formas,
        entradasQuantidade: entradasMes.length
    };
}

function insightsCompromissosMes(referencia) {
    let cartoes = 0;
    let fixos = 0;
    let dividas = 0;

    (Array.isArray(salsiData?.transacoes) ? salsiData.transacoes : []).forEach(transacao => {
        if (transacao?.eDeTerceiro) return;
        const ocorrencia = insightsOcorrenciaTransacaoNoMes(transacao, referencia);
        if (!ocorrencia) return;

        if (transacao.tipo === 'cartao') cartoes += ocorrencia.valor;
        if (transacao.tipo === 'fixo' && transacao.pago !== true) fixos += ocorrencia.valor;
    });

    if (typeof garantirEstruturaDividasManuais === 'function') {
        garantirEstruturaDividasManuais().forEach(divida => {
            (divida.agenda || []).forEach(parcela => {
                const vencimento = typeof dataLocalDivida === 'function'
                    ? dataLocalDivida(parcela.vencimento)
                    : new Date(`${parcela.vencimento || ''}T12:00:00`);
                if (!vencimento || Number.isNaN(vencimento.getTime())) return;
                if (vencimento.getMonth() !== referencia.getMonth()
                    || vencimento.getFullYear() !== referencia.getFullYear()) return;
                dividas += typeof obterRestanteParcelaDivida === 'function'
                    ? obterRestanteParcelaDivida(parcela)
                    : Number(parcela.valorPrevisto || 0);
            });
        });
    }

    return {
        referencia,
        cartoes,
        fixos,
        dividas,
        total: cartoes + fixos + dividas
    };
}

function insightsDefinirTexto(id, texto) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = texto;
}

function insightsRenderizarHistorico(referencia) {
    const container = document.getElementById('insights-history-chart');
    if (!container) return [];

    const meses = Array.from({ length: 6 }, (_, indice) =>
        insightsResumoMes(insightsAdicionarMes(referencia, indice - 5))
    );
    const maximo = Math.max(1, ...meses.flatMap(mes => [mes.entradas, mes.gastos]));

    container.innerHTML = meses.map((mes, indice) => {
        const alturaEntrada = mes.entradas > 0 ? Math.max(3, Math.round((mes.entradas / maximo) * 100)) : 2;
        const alturaGasto = mes.gastos > 0 ? Math.max(3, Math.round((mes.gastos / maximo) * 100)) : 2;
        const saldo = mes.saldo;
        return `
            <div class="insights-history-month ${indice === meses.length - 1 ? 'is-current' : ''}">
                <div class="insights-history-bars" title="Entradas: ${insightsMoeda(mes.entradas)} · Saídas: ${insightsMoeda(mes.gastos)}">
                    <i class="insights-history-bar" style="height:${alturaEntrada}%"></i>
                    <i class="insights-history-bar is-expense" style="height:${alturaGasto}%"></i>
                </div>
                <strong>${insightsMes(mes.referencia, 'short')}</strong>
                <small class="insights-money">${saldo >= 0 ? '+' : '-'} ${insightsMoeda(Math.abs(saldo))}</small>
            </div>`;
    }).join('');

    return meses;
}

function insightsRenderizarCategorias(resumo) {
    const container = document.getElementById('insights-categories-list');
    if (!container) return [];

    const categorias = Object.entries(resumo.categorias)
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);
    const maior = categorias[0]?.valor || 1;

    container.innerHTML = categorias.length
        ? categorias.map(categoria => `
            <div class="insights-category-row">
                <span title="${insightsEscaparHtml(categoria.nome)}">${insightsEscaparHtml(categoria.nome)}</span>
                <strong class="insights-money">${insightsMoeda(categoria.valor)}</strong>
                <div class="insights-category-track" aria-hidden="true"><i style="width:${Math.max(3, (categoria.valor / maior) * 100)}%"></i></div>
            </div>`).join('')
        : '<div class="insights-list-empty">Nenhuma categoria com gasto realizado neste mês.</div>';

    return categorias;
}

function insightsOrcamentosUltrapassados(resumo) {
    if (typeof getMetaOrcamento !== 'function') return [];
    const mes = resumo.referencia.getMonth();
    const ano = resumo.referencia.getFullYear();

    return Object.entries(resumo.categorias)
        .map(([nome, valor]) => {
            const limite = Number(getMetaOrcamento(nome, mes, ano) || 0);
            return { nome, valor, limite, excesso: valor - limite };
        })
        .filter(item => item.limite > 0 && item.excesso > 0.005)
        .sort((a, b) => b.excesso - a.excesso);
}

function insightsRenderizarLeituras(resumo, anterior, categorias, compromissos) {
    const container = document.getElementById('insights-reading-list');
    if (!container) return;

    const leituras = [];
    const comprometimento = resumo.renda > 0 ? (resumo.gastos / resumo.renda) * 100 : 0;

    if (resumo.saldo < 0) {
        leituras.push({
            tipo: 'attention', icone: 'fi-rr-exclamation', rotulo: 'Atenção',
            titulo: 'O mês está negativo',
            texto: `As saídas realizadas superam as entradas em ${insightsMoeda(Math.abs(resumo.saldo))}.`
        });
    } else if (resumo.pendente > resumo.saldo && resumo.pendente > 0) {
        leituras.push({
            tipo: 'attention', icone: 'fi-rr-time-fast', rotulo: 'Previsão',
            titulo: 'Os compromissos mudam o cenário',
            texto: `Há ${insightsMoeda(resumo.pendente)} ainda em aberto; se tudo for pago, o saldo previsto fica em ${insightsMoeda(resumo.previsto)}.`
        });
    } else {
        leituras.push({
            tipo: 'positive', icone: 'fi-rr-check-circle', rotulo: 'Equilíbrio',
            titulo: 'O saldo registrado está positivo',
            texto: comprometimento > 0
                ? `${insightsPercentual(comprometimento)} da renda cadastrada já foi comprometida.`
                : 'As entradas registradas ainda superam as saídas realizadas.'
        });
    }

    if (anterior.gastos > 0.005) {
        const variacao = ((resumo.gastos - anterior.gastos) / anterior.gastos) * 100;
        const subiu = variacao > 0.5;
        const caiu = variacao < -0.5;
        leituras.push({
            tipo: subiu ? 'attention' : 'opportunity',
            icone: subiu ? 'fi-rr-arrow-trend-up' : 'fi-rr-arrow-trend-down',
            rotulo: 'Comparação',
            titulo: caiu ? 'Os gastos diminuíram' : (subiu ? 'Os gastos aumentaram' : 'Os gastos ficaram estáveis'),
            texto: `${insightsPercentual(Math.abs(variacao))} ${subiu ? 'acima' : (caiu ? 'abaixo' : 'de diferença em relação')} de ${insightsMes(anterior.referencia, 'long')}.`
        });
    } else {
        leituras.push({
            tipo: 'opportunity', icone: 'fi-rr-chart-line-up', rotulo: 'Histórico',
            titulo: 'Comparativo em construção',
            texto: 'O mês anterior ainda não possui gastos suficientes para uma comparação.'
        });
    }

    const orcamentos = insightsOrcamentosUltrapassados(resumo);
    if (orcamentos.length) {
        const principal = orcamentos[0];
        leituras.push({
            tipo: 'attention', icone: 'fi-rr-bullseye-arrow', rotulo: 'Orçamento',
            titulo: `${principal.nome} passou do limite`,
            texto: `O valor está ${insightsMoeda(principal.excesso)} acima do orçamento definido para a categoria.`
        });
    } else if (categorias.length) {
        const principal = categorias[0];
        const participacao = resumo.gastos > 0 ? (principal.valor / resumo.gastos) * 100 : 0;
        leituras.push({
            tipo: participacao >= 40 ? 'attention' : 'opportunity',
            icone: 'fi-rr-chart-pie-alt', rotulo: 'Concentração',
            titulo: `${principal.nome} lidera os gastos`,
            texto: `A categoria representa ${insightsPercentual(participacao)} das saídas realizadas no mês.`
        });
    } else {
        const proximo = compromissos[1];
        leituras.push({
            tipo: 'opportunity', icone: 'fi-rr-calendar-clock', rotulo: 'Próximo mês',
            titulo: proximo?.total ? `${insightsMoeda(proximo.total)} já cadastrados` : 'Nenhum compromisso encontrado',
            texto: proximo?.total ? 'Esse valor considera apenas obrigações que já estão no GugetFin.' : 'Ainda não existem parcelas ou contas pendentes cadastradas para o próximo mês.'
        });
    }

    container.innerHTML = leituras.slice(0, 3).map(leitura => `
        <article class="insights-reading-item is-${leitura.tipo}">
            <span class="insights-reading-icon"><i class="fi ${leitura.icone}" aria-hidden="true"></i></span>
            <div class="insights-reading-copy">
                <small>${leitura.rotulo}</small>
                <strong>${insightsEscaparHtml(leitura.titulo)}</strong>
                <p>${insightsEscaparHtml(leitura.texto)}</p>
            </div>
        </article>`).join('');
}

function insightsRenderizarPrevisao(referencia) {
    const container = document.getElementById('insights-forecast-list');
    if (!container) return [];

    const meses = Array.from({ length: 6 }, (_, indice) =>
        insightsCompromissosMes(insightsAdicionarMes(referencia, indice))
    );
    const maximo = Math.max(1, ...meses.map(mes => mes.total));

    container.innerHTML = meses.map((mes, indice) => {
        const altura = mes.total > 0 ? Math.max(4, Math.round((mes.total / maximo) * 100)) : 2;
        const partes = [];
        if (mes.cartoes > 0.005) partes.push('cartões');
        if (mes.fixos > 0.005) partes.push('fixos');
        if (mes.dividas > 0.005) partes.push('dívidas');
        return `
            <article class="insights-forecast-item ${indice === 0 ? 'is-current' : ''}" title="Cartões: ${insightsMoeda(mes.cartoes)} · Fixos: ${insightsMoeda(mes.fixos)} · Dívidas: ${insightsMoeda(mes.dividas)}">
                <span>${insightsMes(mes.referencia, 'short')}</span>
                <div class="insights-forecast-meter" aria-hidden="true"><i style="transform:scaleY(${altura / 100})"></i></div>
                <strong class="insights-money">${insightsMoeda(mes.total)}</strong>
                <small>${partes.length ? partes.join(' + ') : 'sem compromissos'}</small>
            </article>`;
    }).join('');

    return meses;
}

function renderizarGugetInsights() {
    const view = document.getElementById('insights-view');
    if (!view || typeof dataFiltro === 'undefined' || typeof salsiData === 'undefined') return;

    const referencia = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth(), 1, 12);
    const resumo = insightsResumoMes(referencia);
    const anterior = insightsResumoMes(insightsAdicionarMes(referencia, -1));
    const temDadosGlobais = (salsiData.entradas || []).length
        || (salsiData.transacoes || []).length
        || (salsiData.dividasManuais || []).length;
    const vazio = document.getElementById('insights-empty');
    const conteudo = document.getElementById('insights-content');

    if (vazio) vazio.hidden = !!temDadosGlobais;
    if (conteudo) conteudo.hidden = !temDadosGlobais;
    insightsDefinirTexto('insights-period-label', insightsMes(referencia, 'long'));
    if (!temDadosGlobais) return;

    const comprometimento = resumo.renda > 0 ? (resumo.gastos / resumo.renda) * 100 : 0;
    const cardSaldo = document.getElementById('insights-balance-card');
    const atencao = resumo.saldo < 0 || resumo.previsto < 0 || comprometimento > 100;
    if (cardSaldo) cardSaldo.classList.toggle('is-attention', atencao);

    let titulo = 'Mês sob controle';
    let texto = 'As entradas registradas cobrem as saídas realizadas e os compromissos conhecidos.';
    if (!resumo.entradas && resumo.gastos) {
        titulo = 'Faltam entradas cadastradas';
        texto = 'Existem gastos no mês, mas nenhuma entrada foi registrada para comparar o resultado.';
    } else if (resumo.saldo < 0) {
        titulo = 'As saídas passaram das entradas';
        texto = `O resultado registrado está negativo em ${insightsMoeda(Math.abs(resumo.saldo))}.`;
    } else if (resumo.previsto < 0) {
        titulo = 'Atenção aos compromissos em aberto';
        texto = `O saldo atual é positivo, mas pode chegar a ${insightsMoeda(resumo.previsto)} depois dos pagamentos previstos.`;
    } else if (!resumo.gastos && !resumo.entradas) {
        titulo = 'Mês sem movimentações';
        texto = 'Não há entradas ou saídas realizadas neste período.';
    }

    insightsDefinirTexto('insights-status-title', titulo);
    insightsDefinirTexto('insights-status-text', texto);
    insightsDefinirTexto('insights-balance-value', insightsMoeda(resumo.saldo));
    insightsDefinirTexto('insights-balance-detail', resumo.pendente > 0
        ? `Saldo previsto após compromissos: ${insightsMoeda(resumo.previsto)}`
        : 'Entradas menos saídas realizadas');
    insightsDefinirTexto('insights-income-value', insightsMoeda(resumo.entradas));
    insightsDefinirTexto('insights-income-detail', `${resumo.entradasQuantidade} entrada${resumo.entradasQuantidade === 1 ? '' : 's'} registrada${resumo.entradasQuantidade === 1 ? '' : 's'}`);
    insightsDefinirTexto('insights-expense-value', insightsMoeda(resumo.gastos));
    insightsDefinirTexto('insights-expense-detail', `${resumo.quantidade} lançamento${resumo.quantidade === 1 ? '' : 's'} contabilizado${resumo.quantidade === 1 ? '' : 's'}`);
    insightsDefinirTexto('insights-ratio-value', insightsPercentual(comprometimento));
    insightsDefinirTexto('insights-ratio-detail', resumo.renda > 0 ? 'Das entradas que contam como renda' : 'Cadastre renda para comparar');
    insightsDefinirTexto('insights-pending-value', insightsMoeda(resumo.pendente));
    insightsDefinirTexto('insights-pending-detail', resumo.pendente > 0
        ? `${insightsMoeda(resumo.fixosPendentes)} fixos + ${insightsMoeda(resumo.dividasPendentes)} dívidas`
        : 'Nenhum compromisso adicional no mês');

    insightsRenderizarHistorico(referencia);
    const categorias = insightsRenderizarCategorias(resumo);
    const compromissos = insightsRenderizarPrevisao(referencia);
    insightsRenderizarLeituras(resumo, anterior, categorias, compromissos);

    if (typeof aplicarPrivacidadeValores === 'function') {
        requestAnimationFrame(aplicarPrivacidadeValores);
    }
}

function irParaInsights() {
    const main = document.querySelector('main');
    if (!main) return;

    if (typeof fecharMenuAcoesMobile === 'function') fecharMenuAcoesMobile();
    document.querySelectorAll('.tab-content').forEach(secao => {
        secao.classList.remove('active');
        secao.style.setProperty('display', 'none', 'important');
    });

    main.classList.remove('calendar-mode', 'visualizacoes-mode', 'settings-mode', 'dashboard-mode');
    main.classList.add('insights-mode');

    if (typeof marcarViewSidebar === 'function') marcarViewSidebar('insights');
    document.querySelectorAll('.mobile-tab-bar .tab-btn').forEach(btn => btn.classList.remove('active'));
    renderizarGugetInsights();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.renderizarGugetInsights = renderizarGugetInsights;
window.irParaInsights = irParaInsights;
