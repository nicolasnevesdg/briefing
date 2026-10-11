(function () {
    const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    function moeda(valor) {
        return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function numero(valor) {
        if (typeof valor === 'number') return valor;
        const texto = String(valor || '').replace(/\s/g, '').replace(/R\$/g, '');
        if (!texto) return 0;
        return Number(texto.replace(/\./g, '').replace(',', '.')) || 0;
    }

    function textoSeguro(valor) {
        return String(valor || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function chaveMes() {
        return `${dataFiltro.getFullYear()}-${String(dataFiltro.getMonth() + 1).padStart(2, '0')}`;
    }

    function dadosMes() {
        if (!salsiData.planejamentoFaturas || typeof salsiData.planejamentoFaturas !== 'object') {
            salsiData.planejamentoFaturas = {};
        }
        if (!salsiData.planejamentoFaturas[chaveMes()]) salsiData.planejamentoFaturas[chaveMes()] = {};
        return salsiData.planejamentoFaturas[chaveMes()];
    }

    function cartoesCredito() {
        const detalhes = salsiData.config?.detalhesBancos || [];
        return detalhes.filter(cartao => cartao && !cartao.isDebitoOnly && cartao.nome);
    }

    function valorPrevisto(cartao) {
        const mes = dataFiltro.getMonth();
        const ano = dataFiltro.getFullYear();
        return (salsiData.transacoes || []).reduce((total, transacao) => {
            if (transacao.tipo !== 'cartao' || transacao.banco !== cartao) return total;
            const inicio = typeof calcularCompetenciaInicialGasto === 'function'
                ? calcularCompetenciaInicialGasto(transacao)
                : new Date(`${transacao.dataCompra}T12:00:00`);
            const diferenca = (ano - inicio.getFullYear()) * 12 + (mes - inicio.getMonth());
            return diferenca >= 0 && diferenca < Number(transacao.parcelas || 1)
                ? total + Number(transacao.valorParcela || transacao.valorTotal || 0)
                : total;
        }, 0);
    }

    function totalEntradas() {
        const mes = dataFiltro.getMonth();
        const ano = dataFiltro.getFullYear();
        return (salsiData.entradas || [])
            .filter(entrada => entrada.mes === mes && entrada.ano === ano)
            .reduce((total, entrada) => total + Number(entrada.valor || 0), 0);
    }

    function dataLocal(valor) {
        if (!valor) return null;
        const data = new Date(`${valor}T12:00:00`);
        return Number.isNaN(data.getTime()) ? null : data;
    }

    function valorPago(parcela) {
        return (parcela?.pagamentos || []).reduce((total, pagamento) => total + Number(pagamento.valor || 0), 0);
    }

    function valorRestante(parcela) {
        return Math.max(0, Number(parcela?.valorPrevisto || 0) - valorPago(parcela));
    }

    function dividasDoMes() {
        const dividas = typeof garantirEstruturaDividasManuais === 'function'
            ? garantirEstruturaDividasManuais()
            : (Array.isArray(salsiData.dividasManuais) ? salsiData.dividasManuais : []);
        const mes = dataFiltro.getMonth();
        const ano = dataFiltro.getFullYear();

        return dividas.map((divida, indice) => {
            const parcelas = (divida.agenda || []).filter(parcela => {
                const vencimento = dataLocal(parcela.vencimento);
                return vencimento && vencimento.getMonth() === mes && vencimento.getFullYear() === ano;
            });
            if (!parcelas.length) return null;

            const previsto = parcelas.reduce((total, parcela) => total + Number(parcela.valorPrevisto || 0), 0);
            const pago = parcelas.reduce((total, parcela) => total + valorPago(parcela), 0);
            const restante = parcelas.reduce((total, parcela) => total + valorRestante(parcela), 0);
            if (restante <= 0.005) return null;

            const dias = [...new Set(parcelas
                .map(parcela => dataLocal(parcela.vencimento)?.getDate())
                .filter(Boolean))].sort((a, b) => a - b);
            const vencimento = dias.length === 1
                ? `Vence dia ${dias[0]}`
                : `Vence nos dias ${dias.join(', ')}`;

            return {
                chave: `divida:${divida.id || indice}`,
                nome: divida.nome || 'Dívida sem nome',
                credor: divida.credor || '',
                previsto,
                pago,
                restante,
                vencimento
            };
        }).filter(Boolean);
    }

    function salvar() {
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
    }

    function atualizarStatusSalvamento(estado) {
        document.querySelectorAll('[data-faturas-save-status]').forEach(status => {
            status.className = `invoice-save-status is-${estado}`;
            status.textContent = estado === 'pending'
                ? 'Alterações não salvas'
                : estado === 'saving' ? 'Salvando...' : 'Tudo salvo';
        });
        document.querySelectorAll('[data-faturas-save-btn]').forEach(botao => {
            botao.disabled = estado === 'saving';
        });
    }

    function classeDiferenca(diferenca) {
        if (Math.abs(diferenca) < 0.005) return 'is-balanced';
        return diferenca < 0 ? 'is-missing' : 'is-surplus';
    }

    function campoPlanejamento(chave, campo, valor, classe, placeholder = '') {
        return `<input class="${classe}" value="${textoSeguro(valor)}" ${campo === 'observacao' ? '' : 'inputmode="decimal"'}
            data-planejamento-chave="${textoSeguro(chave)}" data-planejamento-campo="${campo}"
            ${placeholder ? `placeholder="${textoSeguro(placeholder)}"` : ''}
            oninput="marcarPlanejamentoFaturasPendente()" onchange="atualizarPlanejamentoCompromisso(this)">`;
    }

    function linhaPlanejamento({ chave, titulo, detalhe, previsto, realPadrao, pago = 0, tipo }) {
        const registro = dadosMes()[chave] || {};
        const real = Object.prototype.hasOwnProperty.call(registro, 'real') ? Number(registro.real) : realPadrao;
        const separado = Number(registro.separado || 0);
        const diferenca = separado - real;
        const status = diferenca >= -0.005 ? 'Coberta' : 'Pendente';
        const complementoPrevisto = pago > 0.005 ? `<small>${moeda(pago)} já pago</small>` : '';

        return {
            real,
            separado,
            html: `<tr class="${tipo === 'divida' ? 'is-debt' : 'is-invoice'}">
                <td data-label="${tipo === 'divida' ? 'Dívida' : 'Cartão'}"><strong>${textoSeguro(titulo)}</strong><small>${textoSeguro(detalhe)}</small></td>
                <td data-label="Previsto"><span class="invoice-predicted">${moeda(previsto)}${complementoPrevisto}</span></td>
                <td data-label="Valor real">${campoPlanejamento(chave, 'real', moeda(real), 'invoice-money-input')}</td>
                <td data-label="Separado">${campoPlanejamento(chave, 'separado', moeda(separado), 'invoice-money-input')}</td>
                <td data-label="Falta / sobra"><strong class="invoice-difference ${classeDiferenca(diferenca)}">${moeda(diferenca)}</strong></td>
                <td data-label="Status"><span class="invoice-status ${status === 'Coberta' ? 'paid' : 'pending'}">${status}</span></td>
                <td data-label="Observação">${campoPlanejamento(chave, 'observacao', registro.observacao || '', 'invoice-note-input', tipo === 'divida' ? 'Ex: acordo, vencimento...' : 'Ex: juros, acordo...')}</td>
            </tr>`
        };
    }

    window.atualizarPlanejamentoCompromisso = function (elemento) {
        const chave = elemento?.dataset?.planejamentoChave;
        const campo = elemento?.dataset?.planejamentoCampo;
        if (!chave || !campo) return;
        const mes = dadosMes();
        mes[chave] = mes[chave] || {};
        mes[chave][campo] = campo === 'observacao' ? elemento.value : numero(elemento.value);
        if (campo !== 'observacao') elemento.value = moeda(mes[chave][campo]);
        atualizarStatusSalvamento('saving');
        salvar();
        atualizarStatusSalvamento('saved');
        renderizarPlanejadorFaturas();
    };

    window.atualizarPlanejamentoFatura = function (cartao, campo, elemento) {
        if (!elemento) return;
        elemento.dataset.planejamentoChave = cartao;
        elemento.dataset.planejamentoCampo = campo;
        window.atualizarPlanejamentoCompromisso(elemento);
    };

    window.marcarPlanejamentoFaturasPendente = function () {
        atualizarStatusSalvamento('pending');
    };

    window.salvarPlanejamentoFaturas = function () {
        const mes = dadosMes();
        document.querySelectorAll('[data-planejamento-chave][data-planejamento-campo]').forEach(campo => {
            const chave = campo.dataset.planejamentoChave;
            const nomeCampo = campo.dataset.planejamentoCampo;
            if (!chave || !nomeCampo) return;
            mes[chave] = mes[chave] || {};
            mes[chave][nomeCampo] = nomeCampo === 'observacao' ? campo.value : numero(campo.value);
            if (nomeCampo !== 'observacao') campo.value = moeda(mes[chave][nomeCampo]);
        });
        atualizarStatusSalvamento('saving');
        salvar();
        atualizarStatusSalvamento('saved');
        renderizarPlanejadorFaturas();
        if (typeof mostrarToast === 'function') mostrarToast('Planejamento salvo com sucesso!');
    };

    window.limparPlanejamentoFaturasMes = function () {
        if (!confirm('Limpar os valores reais, separados e observações das faturas e dívidas deste mês?')) return;
        delete salsiData.planejamentoFaturas?.[chaveMes()];
        salvar();
        renderizarPlanejadorFaturas();
    };

    window.renderizarPlanejadorFaturas = function () {
        const planejadores = document.querySelectorAll('[data-invoice-planner]');
        if (!planejadores.length) return;

        const cartoes = cartoesCredito();
        const dividas = dividasDoMes();
        const entradas = totalEntradas();
        let totalFaturas = 0;
        let totalDividas = 0;
        let totalSeparadoFaturas = 0;
        let totalSeparadoDividas = 0;

        const linhasFaturas = cartoes.map(cartao => {
            const previsto = valorPrevisto(cartao.nome);
            const linha = linhaPlanejamento({
                chave: cartao.nome,
                titulo: cartao.nome,
                detalhe: `Vence dia ${cartao.vencimento || '—'}`,
                previsto,
                realPadrao: previsto,
                tipo: 'fatura'
            });
            totalFaturas += linha.real;
            totalSeparadoFaturas += linha.separado;
            return linha.html;
        }).join('');

        const linhasDividas = dividas.map(divida => {
            const linha = linhaPlanejamento({
                chave: divida.chave,
                titulo: divida.nome,
                detalhe: [divida.credor, divida.vencimento].filter(Boolean).join(' · '),
                previsto: divida.previsto,
                realPadrao: divida.restante,
                pago: divida.pago,
                tipo: 'divida'
            });
            totalDividas += linha.real;
            totalSeparadoDividas += linha.separado;
            return linha.html;
        }).join('');

        const totalReal = totalFaturas + totalDividas;
        const totalSeparado = totalSeparadoFaturas + totalSeparadoDividas;
        const saldo = entradas - totalReal;

        planejadores.forEach(planejador => {
            const selecionar = atributo => planejador.querySelector(`[data-faturas-${atributo}]`);
            const tituloMes = selecionar('mes-referencia');
            const listaFaturas = selecionar('lista');
            const listaDividas = selecionar('dividas-lista');
            const vazioFaturas = selecionar('vazio');
            const vazioDividas = selecionar('dividas-vazio');

            if (tituloMes) tituloMes.textContent = `${MESES[dataFiltro.getMonth()]} de ${dataFiltro.getFullYear()}`;
            if (listaFaturas) listaFaturas.innerHTML = linhasFaturas;
            if (listaDividas) listaDividas.innerHTML = linhasDividas;
            if (vazioFaturas) {
                vazioFaturas.hidden = cartoes.length > 0;
                vazioFaturas.innerHTML = '<strong>Nenhum cartão de crédito cadastrado.</strong><span>Adicione um cartão em Minha carteira para montar o planejamento.</span>';
            }
            if (vazioDividas) {
                vazioDividas.hidden = dividas.length > 0;
                vazioDividas.innerHTML = '<strong>Nenhuma dívida pendente neste mês.</strong><span>As dívidas com vencimento no mês aparecem aqui automaticamente.</span>';
            }

            const totalEntradasEl = selecionar('total-entradas');
            const totalRealEl = selecionar('total-real');
            const totalSeparadoEl = selecionar('total-separado');
            const totalDividasEl = selecionar('total-dividas');
            const resumoTotaisEl = selecionar('resumo-totais');
            const saldoEl = selecionar('saldo-geral');
            const legendaEl = selecionar('saldo-legenda');
            const cardSaldoEl = selecionar('card-saldo');
            if (totalEntradasEl) totalEntradasEl.textContent = moeda(entradas);
            if (totalRealEl) totalRealEl.textContent = moeda(totalReal);
            if (totalSeparadoEl) totalSeparadoEl.textContent = moeda(totalSeparado);
            if (totalDividasEl) totalDividasEl.textContent = moeda(totalDividas);
            if (resumoTotaisEl) resumoTotaisEl.textContent = `Faturas: ${moeda(totalFaturas)} · Dívidas: ${moeda(totalDividas)}`;
            if (saldoEl) saldoEl.textContent = moeda(saldo);
            if (legendaEl) legendaEl.textContent = saldo >= 0 ? 'Sobra após quitar faturas e dívidas' : 'Valor que ainda faltará no mês';
            if (cardSaldoEl) cardSaldoEl.classList.toggle('is-negative', saldo < 0);
        });
    };
})();
