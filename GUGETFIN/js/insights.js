/* ========================================================= */
/* GUGET INSIGHTS - COMPARAÇÃO E PREVISÃO LOCAL, SEM IA    */
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

function insightsDiasNoMes(data) {
    return new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
}

function insightsDataIsoValida(valor) {
    const texto = String(valor || '').trim();
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!partes) return false;
    const ano = Number(partes[1]);
    const mes = Number(partes[2]);
    const dia = Number(partes[3]);
    const data = new Date(ano, mes - 1, dia, 12);
    return !Number.isNaN(data.getTime())
        && data.getFullYear() === ano
        && data.getMonth() === mes - 1
        && data.getDate() === dia;
}

function insightsCompetenciaTransacao(transacao) {
    if (!insightsDataIsoValida(transacao?.dataCompra)) return null;

    try {
        if (typeof calcularCompetenciaInicialGasto === 'function') {
            const competencia = calcularCompetenciaInicialGasto(transacao);
            if (competencia instanceof Date && !Number.isNaN(competencia.getTime())) {
                return new Date(competencia.getFullYear(), competencia.getMonth(), 1, 12);
            }
            return null;
        }
    } catch (error) {
        // Registros antigos continuam com a data original como fallback.
    }

    const data = new Date(`${transacao.dataCompra}T12:00:00`);
    return Number.isNaN(data.getTime()) ? null : new Date(data.getFullYear(), data.getMonth(), 1, 12);
}

function insightsOcorrenciaTransacaoNoMes(transacao, referencia) {
    const inicio = insightsCompetenciaTransacao(transacao);
    if (!inicio) return null;

    const parcelas = Math.max(1, Number(transacao?.parcelas || 1));
    const diferenca = (referencia.getFullYear() - inicio.getFullYear()) * 12
        + (referencia.getMonth() - inicio.getMonth());
    if (!Number.isFinite(diferenca) || diferenca < 0 || diferenca >= parcelas) return null;

    const valorTotal = Number(transacao?.valorTotal || transacao?.valor || 0);
    const valor = transacao?.tipo === 'cartao'
        ? Number(transacao?.valorParcela || (valorTotal / parcelas) || 0)
        : valorTotal;
    const compra = new Date(`${transacao.dataCompra}T12:00:00`);
    const compraNaCompetencia = compra.getFullYear() === referencia.getFullYear()
        && compra.getMonth() === referencia.getMonth();
    const diaAnalitico = transacao.tipo === 'cartao' && (!compraNaCompetencia || diferenca > 0)
        ? 1
        : Math.min(compra.getDate(), insightsDiasNoMes(referencia));

    return {
        valor: Math.max(0, valor),
        parcela: diferenca + 1,
        parcelas,
        diaAnalitico
    };
}

function insightsDividasPendentesMes(referencia) {
    let total = 0;

    if (typeof garantirEstruturaDividasManuais === 'function') {
        garantirEstruturaDividasManuais().forEach(divida => {
            (divida.agenda || []).forEach(parcela => {
                const vencimento = typeof dataLocalDivida === 'function'
                    ? dataLocalDivida(parcela.vencimento)
                    : new Date(`${parcela.vencimento || ''}T12:00:00`);
                if (!(vencimento instanceof Date) || Number.isNaN(vencimento.getTime())) return;
                if (vencimento.getMonth() !== referencia.getMonth()
                    || vencimento.getFullYear() !== referencia.getFullYear()) return;
                const restante = typeof obterRestanteParcelaDivida === 'function'
                    ? obterRestanteParcelaDivida(parcela)
                    : Number(parcela.valorPrevisto || 0);
                total += Math.max(0, Number(restante || 0));
            });
        });
    }

    if (typeof calcularDividasCompartilhadasPendentesSaldoPrevisto === 'function') {
        const recebidas = typeof dashboardDividasRecebidas !== 'undefined'
            ? dashboardDividasRecebidas
            : [];
        total += calcularDividasCompartilhadasPendentesSaldoPrevisto(
            referencia.getMonth(),
            referencia.getFullYear(),
            recebidas
        );
    }

    return total;
}

function insightsResumoMes(referencia, limiteDia = null) {
    const mes = referencia.getMonth();
    const ano = referencia.getFullYear();
    const categorias = {};
    const itens = [];
    let gastos = 0;
    let fixosPendentes = 0;
    let ocorrencias = 0;

    (Array.isArray(salsiData?.transacoes) ? salsiData.transacoes : []).forEach((transacao, index) => {
        if (transacao?.eDeTerceiro) return;
        const ocorrencia = insightsOcorrenciaTransacaoNoMes(transacao, referencia);
        if (!ocorrencia) return;

        if (transacao.tipo === 'fixo' && transacao.pago !== true) {
            fixosPendentes += ocorrencia.valor;
            return;
        }

        const temLimiteDia = limiteDia !== null
            && limiteDia !== undefined
            && Number.isFinite(Number(limiteDia));
        if (temLimiteDia && ocorrencia.diaAnalitico > Number(limiteDia)) return;

        gastos += ocorrencia.valor;
        ocorrencias += 1;
        const categoria = String(transacao.categoria || 'Sem categoria').trim() || 'Sem categoria';
        categorias[categoria] = (categorias[categoria] || 0) + ocorrencia.valor;
        itens.push({
            index,
            transacao,
            nome: String(transacao.nome || 'Sem nome').trim() || 'Sem nome',
            categoria,
            valor: ocorrencia.valor,
            dia: ocorrencia.diaAnalitico
        });
    });

    const dividasPendentes = insightsDividasPendentesMes(referencia);
    return {
        referencia,
        gastos,
        categorias,
        itens,
        ocorrencias,
        fixosPendentes,
        dividasPendentes,
        pendente: fixosPendentes + dividasPendentes
    };
}

function insightsCompromissosMes(referencia) {
    let cartoes = 0;
    let fixos = 0;

    (Array.isArray(salsiData?.transacoes) ? salsiData.transacoes : []).forEach(transacao => {
        if (transacao?.eDeTerceiro) return;
        const ocorrencia = insightsOcorrenciaTransacaoNoMes(transacao, referencia);
        if (!ocorrencia) return;
        if (transacao.tipo === 'cartao') cartoes += ocorrencia.valor;
        if (transacao.tipo === 'fixo' && transacao.pago !== true) fixos += ocorrencia.valor;
    });

    const dividas = insightsDividasPendentesMes(referencia);
    return {
        referencia,
        cartoes,
        fixos,
        dividas,
        total: cartoes + fixos + dividas
    };
}

function insightsMedia(valores) {
    const validos = valores.filter(valor => Number.isFinite(Number(valor))).map(Number);
    return validos.length ? validos.reduce((total, valor) => total + valor, 0) / validos.length : 0;
}

function insightsEstadoPeriodo(referencia) {
    const agora = new Date();
    const atual = new Date(agora.getFullYear(), agora.getMonth(), 1, 12);
    const alvo = new Date(referencia.getFullYear(), referencia.getMonth(), 1, 12);
    if (alvo.getTime() === atual.getTime()) return 'atual';
    return alvo < atual ? 'passado' : 'futuro';
}

function insightsDadosComparativos(referencia) {
    const estado = insightsEstadoPeriodo(referencia);
    const agora = new Date();
    const limiteDia = estado === 'atual' ? agora.getDate() : insightsDiasNoMes(referencia);
    const resumoCompleto = insightsResumoMes(referencia);
    const resumoPeriodo = insightsResumoMes(referencia, limiteDia);
    const anteriores = Array.from({ length: 3 }, (_, indice) => {
        const mes = insightsAdicionarMes(referencia, -(indice + 1));
        return {
            periodo: insightsResumoMes(mes, Math.min(limiteDia, insightsDiasNoMes(mes))),
            completo: insightsResumoMes(mes)
        };
    }).filter(item => item.completo.ocorrencias > 0);
    const mediaPeriodo = insightsMedia(anteriores.map(item => item.periodo.gastos));
    const mediaCompleta = insightsMedia(anteriores.map(item => item.completo.gastos));
    const diferenca = resumoPeriodo.gastos - mediaPeriodo;
    const variacao = mediaPeriodo > 0 ? (diferenca / mediaPeriodo) * 100 : null;
    const conhecido = resumoCompleto.gastos + resumoCompleto.pendente;

    let projecao = conhecido;
    if (estado === 'atual') {
        const porRitmoHistorico = mediaPeriodo > 0 && mediaCompleta > 0
            ? mediaCompleta * (resumoPeriodo.gastos / mediaPeriodo)
            : (resumoPeriodo.gastos / Math.max(1, limiteDia)) * insightsDiasNoMes(referencia);
        projecao = Math.max(conhecido, porRitmoHistorico);
    } else if (estado === 'passado') {
        projecao = resumoCompleto.gastos;
    } else {
        projecao = insightsCompromissosMes(referencia).total;
    }

    return {
        estado,
        limiteDia,
        resumoCompleto,
        resumoPeriodo,
        anteriores,
        mediaPeriodo,
        mediaCompleta,
        diferenca,
        variacao,
        projecao
    };
}

function insightsDefinirTexto(id, texto) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = texto;
}

function insightsRenderizarSinais(dados, alivios) {
    const cardComparacao = document.getElementById('insights-comparison-card');
    cardComparacao?.classList.remove('is-up', 'is-down', 'is-neutral');

    if (dados.estado === 'futuro') {
        const compromissos = insightsCompromissosMes(dados.resumoCompleto.referencia);
        cardComparacao?.classList.add('is-neutral');
        insightsDefinirTexto('insights-comparison-value', insightsMoeda(compromissos.total));
        insightsDefinirTexto('insights-comparison-title', 'já comprometidos neste mês');
        insightsDefinirTexto('insights-comparison-detail', 'Valor formado por cartões, contas fixas pendentes e dívidas cadastradas.');
        insightsDefinirTexto('insights-comparison-context', 'Planejamento futuro, sem estimar novas compras');
    } else if (!dados.anteriores.length || dados.variacao === null) {
        cardComparacao?.classList.add('is-neutral');
        insightsDefinirTexto('insights-comparison-value', '—');
        insightsDefinirTexto('insights-comparison-title', 'Histórico em construção');
        insightsDefinirTexto('insights-comparison-detail', 'Ainda faltam meses anteriores com gastos para formar uma comparação confiável.');
        insightsDefinirTexto('insights-comparison-context', `${dados.resumoPeriodo.ocorrencias} lançamento${dados.resumoPeriodo.ocorrencias === 1 ? '' : 's'} no período`);
    } else {
        const subiu = dados.variacao > 0.5;
        const caiu = dados.variacao < -0.5;
        cardComparacao?.classList.add(subiu ? 'is-up' : (caiu ? 'is-down' : 'is-neutral'));
        insightsDefinirTexto('insights-comparison-value', `${subiu ? '↑' : (caiu ? '↓' : '→')} ${insightsPercentual(Math.abs(dados.variacao))}`);
        insightsDefinirTexto('insights-comparison-title', subiu ? 'acima da sua média' : (caiu ? 'abaixo da sua média' : 'em linha com sua média'));
        insightsDefinirTexto('insights-comparison-detail', `${insightsMoeda(Math.abs(dados.diferenca))} ${subiu ? 'a mais' : (caiu ? 'a menos' : 'de diferença')} no mesmo período.`);
        insightsDefinirTexto('insights-comparison-context', dados.estado === 'atual'
            ? `Comparação até o dia ${dados.limiteDia} com ${dados.anteriores.length} ${dados.anteriores.length === 1 ? 'mês anterior' : 'meses anteriores'}`
            : `Comparado à média dos ${dados.anteriores.length} meses anteriores`);
    }

    insightsDefinirTexto('insights-projection-value', insightsMoeda(dados.projecao));
    if (dados.estado === 'atual') {
        insightsDefinirTexto('insights-projection-title', 'possível fechamento do mês');
        insightsDefinirTexto('insights-projection-detail', `Já existem ${insightsMoeda(dados.resumoCompleto.gastos + dados.resumoCompleto.pendente)} entre gastos e compromissos conhecidos.`);
        insightsDefinirTexto('insights-projection-context', 'Estimativa recalculada a cada lançamento');
    } else if (dados.estado === 'passado') {
        insightsDefinirTexto('insights-projection-title', 'foi o fechamento do mês');
        insightsDefinirTexto('insights-projection-detail', 'O mês já terminou, portanto exibimos o valor realizado em vez de uma projeção.');
        insightsDefinirTexto('insights-projection-context', 'Resultado consolidado do período');
    } else {
        insightsDefinirTexto('insights-projection-title', 'já previstos para o mês');
        insightsDefinirTexto('insights-projection-detail', 'Considera somente compromissos cadastrados; novas compras ainda não podem ser previstas.');
        insightsDefinirTexto('insights-projection-context', 'Previsão mínima conhecida');
    }

    const proximos60 = alivios.filter(item => item.diferencaMes >= 1 && item.diferencaMes <= 2);
    const total60 = proximos60.reduce((total, item) => total + item.valor, 0);
    const proximo = alivios[0];
    if (total60 > 0.005) {
        insightsDefinirTexto('insights-relief-value', `${insightsMoeda(total60)}/mês`);
        insightsDefinirTexto('insights-relief-title', 'serão liberados em até 60 dias');
        insightsDefinirTexto('insights-relief-detail', proximos60.map(item => `${insightsMes(item.referencia, 'short')}: ${insightsMoeda(item.valor)}`).join(' · '));
        insightsDefinirTexto('insights-relief-context', `${proximos60.reduce((total, item) => total + item.quantidade, 0)} parcelamento${proximos60.reduce((total, item) => total + item.quantidade, 0) === 1 ? '' : 's'} terminando`);
    } else if (proximo) {
        insightsDefinirTexto('insights-relief-value', `${insightsMoeda(proximo.valor)}/mês`);
        insightsDefinirTexto('insights-relief-title', `serão liberados em ${insightsMes(proximo.referencia, 'long')}`);
        insightsDefinirTexto('insights-relief-detail', `${proximo.quantidade} parcelamento${proximo.quantidade === 1 ? '' : 's'} termina${proximo.quantidade === 1 ? '' : 'm'} nesse período.`);
        insightsDefinirTexto('insights-relief-context', 'Próximo alívio encontrado nos dados cadastrados');
    } else {
        insightsDefinirTexto('insights-relief-value', '—');
        insightsDefinirTexto('insights-relief-title', 'Nenhuma parcela terminando em breve');
        insightsDefinirTexto('insights-relief-detail', 'Os compromissos cadastrados continuam ativos nos próximos seis meses.');
        insightsDefinirTexto('insights-relief-context', 'O cenário muda quando novos parcelamentos são registrados');
    }
}

function insightsRenderizarHistorico(dados) {
    const container = document.getElementById('insights-history-chart');
    if (!container) return;

    const referencia = dados.resumoCompleto.referencia;
    const meses = Array.from({ length: 6 }, (_, indice) => {
        const mes = insightsAdicionarMes(referencia, indice - 5);
        const resumo = insightsResumoMes(mes);
        const selecionado = indice === 5;
        return {
            referencia: mes,
            realizado: selecionado && dados.estado === 'atual' ? dados.resumoPeriodo.gastos : resumo.gastos,
            projecao: selecionado && dados.estado === 'atual' ? dados.projecao : resumo.gastos,
            selecionado
        };
    });
    const maximo = Math.max(1, ...meses.flatMap(item => [item.realizado, item.projecao]));

    container.innerHTML = meses.map(item => {
        const alturaReal = item.realizado > 0 ? Math.max(3, (item.realizado / maximo) * 100) : 2;
        const alturaProjetada = item.projecao > 0 ? Math.max(3, (item.projecao / maximo) * 100) : 2;
        const temProjecao = item.selecionado && dados.estado === 'atual' && item.projecao > item.realizado + 0.005;
        return `
            <div class="insights-history-month ${item.selecionado ? 'is-current' : ''}">
                <div class="insights-trend-column" title="Realizado: ${insightsMoeda(item.realizado)}${temProjecao ? ` · Projeção: ${insightsMoeda(item.projecao)}` : ''}">
                    ${temProjecao ? `<em style="height:${alturaProjetada}%"></em>` : ''}
                    <i style="height:${alturaReal}%"></i>
                </div>
                <strong>${insightsMes(item.referencia, 'short')}</strong>
                <small class="insights-money">${insightsMoeda(temProjecao ? item.projecao : item.realizado)}</small>
            </div>`;
    }).join('');

    insightsDefinirTexto('insights-history-context', dados.estado === 'atual'
        ? `A barra de ${insightsMes(referencia, 'short')} separa o que já aconteceu da projeção de ${insightsMoeda(dados.projecao)}.`
        : `O mês selecionado fechou com ${insightsMoeda(dados.resumoCompleto.gastos)} em gastos realizados.`);
}

function insightsMudancasCategoria(dados) {
    const base = dados.anteriores.length || 1;
    const medias = {};
    dados.anteriores.forEach(item => {
        Object.entries(item.periodo.categorias).forEach(([categoria, valor]) => {
            medias[categoria] = (medias[categoria] || 0) + valor / base;
        });
    });

    const nomes = new Set([
        ...Object.keys(dados.resumoPeriodo.categorias),
        ...Object.keys(medias)
    ]);

    return Array.from(nomes).map(nome => {
        const atual = Number(dados.resumoPeriodo.categorias[nome] || 0);
        const media = Number(medias[nome] || 0);
        const diferenca = atual - media;
        const variacao = media > 0 ? (diferenca / media) * 100 : null;
        return { nome, atual, media, diferenca, variacao };
    }).filter(item => Math.abs(item.diferenca) > 0.005)
        .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca))
        .slice(0, 5);
}

function insightsRenderizarMudancasCategorias(dados) {
    const container = document.getElementById('insights-category-changes');
    if (!container) return [];
    const mudancas = insightsMudancasCategoria(dados);

    if (!dados.anteriores.length) {
        container.innerHTML = '<div class="insights-list-empty">Ainda faltam meses anteriores para comparar as categorias.</div>';
        return [];
    }

    if (!mudancas.length) {
        container.innerHTML = '<div class="insights-list-empty">Nenhuma mudança relevante nas categorias deste período.</div>';
        return [];
    }

    container.innerHTML = mudancas.map(item => {
        const subiu = item.diferenca > 0;
        const detalhe = item.variacao === null
            ? 'nova no período'
            : `${insightsPercentual(Math.abs(item.variacao))} ${subiu ? 'acima' : 'abaixo'} da média`;
        return `
            <div class="insights-change-row ${subiu ? 'is-up' : 'is-down'}">
                <span class="insights-change-icon"><i class="fi ${subiu ? 'fi-rr-arrow-trend-up' : 'fi-rr-arrow-trend-down'}" aria-hidden="true"></i></span>
                <div>
                    <strong>${insightsEscaparHtml(item.nome)}</strong>
                    <small>${insightsEscaparHtml(detalhe)}</small>
                </div>
                <b class="insights-money">${subiu ? '+' : '−'} ${insightsMoeda(Math.abs(item.diferenca))}</b>
            </div>`;
    }).join('');
    return mudancas;
}

function insightsNormalizarChave(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function insightsMediana(valores) {
    const ordenados = valores.filter(Number.isFinite).sort((a, b) => a - b);
    if (!ordenados.length) return 0;
    const meio = Math.floor(ordenados.length / 2);
    return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

function insightsEncontrarGastosIncomuns(dados) {
    if (dados.estado === 'futuro') return [];
    const referencia = dados.resumoCompleto.referencia;
    const historico = new Map();

    for (let deslocamento = 1; deslocamento <= 6; deslocamento += 1) {
        insightsResumoMes(insightsAdicionarMes(referencia, -deslocamento)).itens.forEach(item => {
            const chave = `${insightsNormalizarChave(item.nome)}|${insightsNormalizarChave(item.categoria)}`;
            if (!historico.has(chave)) historico.set(chave, []);
            historico.get(chave).push(item.valor);
        });
    }

    return dados.resumoPeriodo.itens.map(item => {
        const chave = `${insightsNormalizarChave(item.nome)}|${insightsNormalizarChave(item.categoria)}`;
        const valores = historico.get(chave) || [];
        const referenciaHabitual = insightsMediana(valores);
        return {
            ...item,
            amostras: valores.length,
            referenciaHabitual,
            diferenca: item.valor - referenciaHabitual,
            multiplicador: referenciaHabitual > 0 ? item.valor / referenciaHabitual : 0
        };
    }).filter(item => item.amostras >= 2 && item.diferenca >= 25 && item.multiplicador >= 1.75)
        .sort((a, b) => b.multiplicador - a.multiplicador);
}

function insightsRenderizarLeituras(dados, mudancas, alivios) {
    const container = document.getElementById('insights-reading-list');
    if (!container) return;
    const leituras = [];
    const incomuns = insightsEncontrarGastosIncomuns(dados);
    const maior = [...dados.resumoPeriodo.itens].sort((a, b) => b.valor - a.valor)[0];
    const principalMudanca = mudancas[0];

    if (incomuns.length) {
        const item = incomuns[0];
        leituras.push({
            tipo: 'attention',
            icone: 'fi-rr-exclamation',
            rotulo: 'Fora do padrão',
            titulo: `${item.nome} · ${insightsMoeda(item.valor)}`,
            texto: `${item.multiplicador.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× acima do valor habitual desse gasto.`
        });
    } else {
        leituras.push({
            tipo: 'positive',
            icone: 'fi-rr-check-circle',
            rotulo: 'Padrão de gastos',
            titulo: 'Nenhuma compra muito fora do habitual',
            texto: 'O GugetFin comparou os lançamentos com os últimos seis meses.'
        });
    }

    if (principalMudanca) {
        const subiu = principalMudanca.diferenca > 0;
        leituras.push({
            tipo: subiu ? 'attention' : 'opportunity',
            icone: subiu ? 'fi-rr-arrow-trend-up' : 'fi-rr-arrow-trend-down',
            rotulo: 'Maior mudança',
            titulo: `${principalMudanca.nome} ${subiu ? 'aumentou' : 'diminuiu'}`,
            texto: `${insightsMoeda(Math.abs(principalMudanca.diferenca))} ${subiu ? 'acima' : 'abaixo'} da média para o mesmo período.`
        });
    } else if (alivios[0]) {
        leituras.push({
            tipo: 'opportunity',
            icone: 'fi-rr-calendar-clock',
            rotulo: 'Próximo alívio',
            titulo: `${insightsMoeda(alivios[0].valor)}/mês em ${insightsMes(alivios[0].referencia, 'short')}`,
            texto: 'Esse valor deixará de pressionar os compromissos mensais.'
        });
    }

    if (maior) {
        leituras.push({
            tipo: 'neutral',
            icone: 'fi-rr-receipt',
            rotulo: 'Maior gasto do período',
            titulo: `${maior.nome} · ${insightsMoeda(maior.valor)}`,
            texto: `${maior.categoria} foi o maior lançamento considerado nesta leitura.`
        });
    } else {
        leituras.push({
            tipo: 'neutral',
            icone: 'fi-rr-receipt',
            rotulo: 'Sem movimentação',
            titulo: 'Nenhum gasto realizado no período',
            texto: 'Os insights serão atualizados assim que novos lançamentos forem registrados.'
        });
    }

    container.innerHTML = leituras.slice(0, 3).map(leitura => `
        <article class="insights-reading-item is-${leitura.tipo}">
            <span class="insights-reading-icon"><i class="fi ${leitura.icone}" aria-hidden="true"></i></span>
            <div class="insights-reading-copy">
                <small>${insightsEscaparHtml(leitura.rotulo)}</small>
                <strong>${insightsEscaparHtml(leitura.titulo)}</strong>
                <p>${insightsEscaparHtml(leitura.texto)}</p>
            </div>
        </article>`).join('');
}

function insightsEventosAlivio(referencia) {
    const eventos = new Map();
    const adicionar = (mes, valor, nome) => {
        const diferencaMes = (mes.getFullYear() - referencia.getFullYear()) * 12 + (mes.getMonth() - referencia.getMonth());
        if (diferencaMes < 1 || diferencaMes > 6 || !(valor > 0.005)) return;
        const chave = `${mes.getFullYear()}-${mes.getMonth()}`;
        if (!eventos.has(chave)) eventos.set(chave, { referencia: mes, valor: 0, quantidade: 0, nomes: [], diferencaMes });
        const evento = eventos.get(chave);
        evento.valor += valor;
        evento.quantidade += 1;
        evento.nomes.push(nome);
    };

    (Array.isArray(salsiData?.transacoes) ? salsiData.transacoes : []).forEach(transacao => {
        if (transacao?.eDeTerceiro || transacao?.tipo !== 'cartao') return;
        const parcelas = Math.max(1, Number(transacao.parcelas || 1));
        if (parcelas <= 1) return;
        const inicio = insightsCompetenciaTransacao(transacao);
        if (!inicio) return;
        const mesAlivio = insightsAdicionarMes(inicio, parcelas);
        const valorTotal = Number(transacao.valorTotal || 0);
        const valorParcela = Number(transacao.valorParcela || (valorTotal / parcelas) || 0);
        adicionar(mesAlivio, valorParcela, transacao.nome || 'Parcelamento');
    });

    if (typeof garantirEstruturaDividasManuais === 'function') {
        garantirEstruturaDividasManuais().forEach(divida => {
            const abertas = (divida.agenda || []).filter(parcela => {
                const restante = typeof obterRestanteParcelaDivida === 'function'
                    ? obterRestanteParcelaDivida(parcela)
                    : Number(parcela.valorPrevisto || 0);
                return restante > 0.005;
            });
            const datas = abertas.map(parcela => typeof dataLocalDivida === 'function'
                ? dataLocalDivida(parcela.vencimento)
                : new Date(`${parcela.vencimento || ''}T12:00:00`))
                .filter(data => data instanceof Date && !Number.isNaN(data.getTime()))
                .sort((a, b) => a - b);
            const ultima = datas[datas.length - 1];
            if (!ultima) return;
            const valor = Number(divida.valorParcela || 0) || Number(abertas[abertas.length - 1]?.valorPrevisto || 0);
            adicionar(insightsAdicionarMes(ultima, 1), valor, divida.credor || 'Dívida');
        });
    }

    return Array.from(eventos.values()).sort((a, b) => a.referencia - b.referencia);
}

function insightsRenderizarPrevisao(referencia) {
    const container = document.getElementById('insights-forecast-list');
    if (!container) return [];
    const meses = Array.from({ length: 6 }, (_, indice) => insightsCompromissosMes(insightsAdicionarMes(referencia, indice)));
    const maximo = Math.max(1, ...meses.map(mes => mes.total));

    container.innerHTML = meses.map((mes, indice) => {
        const altura = mes.total > 0 ? Math.max(4, (mes.total / maximo) * 100) : 2;
        const anterior = indice > 0 ? meses[indice - 1].total : null;
        const diferenca = anterior === null ? 0 : mes.total - anterior;
        let movimento = 'Base conhecida';
        if (anterior !== null && diferenca < -0.005) movimento = `↓ ${insightsMoeda(Math.abs(diferenca))} de alívio`;
        if (anterior !== null && diferenca > 0.005) movimento = `↑ ${insightsMoeda(diferenca)} a mais`;
        if (anterior !== null && Math.abs(diferenca) <= 0.005) movimento = 'Sem mudança';
        return `
            <article class="insights-forecast-item ${indice === 0 ? 'is-current' : ''}" title="Cartões: ${insightsMoeda(mes.cartoes)} · Fixos: ${insightsMoeda(mes.fixos)} · Dívidas: ${insightsMoeda(mes.dividas)}">
                <span>${insightsMes(mes.referencia, 'short')}</span>
                <div class="insights-forecast-meter" aria-hidden="true"><i style="transform:scaleY(${altura / 100})"></i></div>
                <strong class="insights-money">${insightsMoeda(mes.total)}</strong>
                <small class="${diferenca < -0.005 ? 'is-relief' : (diferenca > 0.005 ? 'is-rise' : '')}">${movimento}</small>
            </article>`;
    }).join('');

    const primeiro = meses[0]?.total || 0;
    const ultimo = meses[meses.length - 1]?.total || 0;
    const diferencaFinal = ultimo - primeiro;
    insightsDefinirTexto('insights-forecast-description', Math.abs(diferencaFinal) <= 0.005
        ? 'Os compromissos conhecidos permanecem estáveis ao longo dos próximos meses.'
        : `Até ${insightsMes(meses[meses.length - 1].referencia, 'long')}, os compromissos conhecidos ficam ${insightsMoeda(Math.abs(diferencaFinal))} ${diferencaFinal < 0 ? 'mais leves' : 'mais altos'}.`);
    return meses;
}

function renderizarGugetInsights() {
    const view = document.getElementById('insights-view');
    if (!view || typeof dataFiltro === 'undefined' || typeof salsiData === 'undefined') return;

    const referencia = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth(), 1, 12);
    const temDadosGlobais = (salsiData.transacoes || []).some(transacao => insightsCompetenciaTransacao(transacao))
        || (salsiData.dividasManuais || []).length;
    const vazio = document.getElementById('insights-empty');
    const conteudo = document.getElementById('insights-content');

    if (vazio) vazio.hidden = !!temDadosGlobais;
    if (conteudo) conteudo.hidden = !temDadosGlobais;
    insightsDefinirTexto('insights-period-label', insightsMes(referencia, 'long'));
    if (!temDadosGlobais) return;

    const dados = insightsDadosComparativos(referencia);
    const alivios = insightsEventosAlivio(referencia);
    insightsRenderizarSinais(dados, alivios);
    insightsRenderizarHistorico(dados);
    const mudancas = insightsRenderizarMudancasCategorias(dados);
    insightsRenderizarLeituras(dados, mudancas, alivios);
    insightsRenderizarPrevisao(referencia);

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
