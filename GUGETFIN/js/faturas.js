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

    function salvar() {
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
    }

    function classeDiferenca(diferenca) {
        if (Math.abs(diferenca) < 0.005) return 'is-balanced';
        return diferenca < 0 ? 'is-missing' : 'is-surplus';
    }

    window.atualizarPlanejamentoFatura = function (cartao, campo, elemento) {
        const mes = dadosMes();
        mes[cartao] = mes[cartao] || {};
        mes[cartao][campo] = campo === 'observacao' ? elemento.value : numero(elemento.value);
        if (campo !== 'observacao') elemento.value = moeda(mes[cartao][campo]);
        salvar();
        renderizarPlanejadorFaturas();
    };

    window.limparPlanejamentoFaturasMes = function () {
        if (!confirm('Limpar os valores reais, separados e observações deste mês?')) return;
        delete salsiData.planejamentoFaturas?.[chaveMes()];
        salvar();
        renderizarPlanejadorFaturas();
    };

    window.renderizarPlanejadorFaturas = function () {
        const lista = document.getElementById('faturas-planejador-lista');
        if (!lista) return;
        const cartoes = cartoesCredito();
        const mes = dadosMes();
        const entradas = totalEntradas();
        let totalReal = 0;
        let totalSeparado = 0;

        const tituloMes = document.getElementById('faturas-mes-referencia');
        if (tituloMes) tituloMes.textContent = `${MESES[dataFiltro.getMonth()]} de ${dataFiltro.getFullYear()}`;

        lista.innerHTML = cartoes.map(cartao => {
            const previsto = valorPrevisto(cartao.nome);
            const registro = mes[cartao.nome] || {};
            const real = Object.prototype.hasOwnProperty.call(registro, 'real') ? Number(registro.real) : previsto;
            const separado = Number(registro.separado || 0);
            const diferenca = separado - real;
            totalReal += real;
            totalSeparado += separado;
            const status = diferenca >= -0.005 ? 'Coberta' : 'Pendente';
            return `<tr>
                <td data-label="Cartão"><strong>${cartao.nome}</strong><small>Vence dia ${cartao.vencimento || '—'}</small></td>
                <td data-label="Previsto"><span class="invoice-predicted">${moeda(previsto)}</span></td>
                <td data-label="Valor real"><input class="invoice-money-input" value="${moeda(real)}" inputmode="decimal" onchange="atualizarPlanejamentoFatura('${cartao.nome.replace(/'/g, "\\'")}', 'real', this)"></td>
                <td data-label="Separado"><input class="invoice-money-input" value="${moeda(separado)}" inputmode="decimal" onchange="atualizarPlanejamentoFatura('${cartao.nome.replace(/'/g, "\\'")}', 'separado', this)"></td>
                <td data-label="Falta / sobra"><strong class="invoice-difference ${classeDiferenca(diferenca)}">${moeda(diferenca)}</strong></td>
                <td data-label="Status"><span class="invoice-status ${status === 'Coberta' ? 'paid' : 'pending'}">${status}</span></td>
                <td data-label="Observação"><input class="invoice-note-input" value="${String(registro.observacao || '').replace(/"/g, '&quot;')}" placeholder="Ex: juros, acordo..." onchange="atualizarPlanejamentoFatura('${cartao.nome.replace(/'/g, "\\'")}', 'observacao', this)"></td>
            </tr>`;
        }).join('');

        const vazio = document.getElementById('faturas-planejador-vazio');
        if (vazio) {
            vazio.hidden = cartoes.length > 0;
            vazio.innerHTML = '<strong>Nenhum cartão de crédito cadastrado.</strong><span>Adicione um cartão em Minha carteira para montar o planejamento.</span>';
        }

        const saldo = entradas - totalReal;
        document.getElementById('faturas-total-entradas').textContent = moeda(entradas);
        document.getElementById('faturas-total-real').textContent = moeda(totalReal);
        document.getElementById('faturas-total-separado').textContent = moeda(totalSeparado);
        document.getElementById('faturas-saldo-geral').textContent = moeda(saldo);
        document.getElementById('faturas-saldo-legenda').textContent = saldo >= 0 ? 'Sobra após quitar as faturas' : 'Valor que ainda faltará no mês';
        document.getElementById('faturas-card-saldo').classList.toggle('is-negative', saldo < 0);
    };
})();
