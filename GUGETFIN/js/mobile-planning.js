(function () {
    const FILTROS = {
        todos: 'Tudo',
        gastos: 'Gastos',
        terceiros: 'Terceiros',
        entradas: 'Entradas',
        vencimentos: 'Vencimentos'
    };

    let filtroAtivo = 'todos';
    let diaSelecionado = new Date().getDate();
    let periodoRenderizado = '';

    function escaparHtml(valor) {
        return String(valor ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function atualizarSeta(cardId, iconeId) {
        const card = document.getElementById(cardId);
        const icone = document.getElementById(iconeId);
        if (icone) icone.style.transform = card?.classList.contains('expanded') ? 'rotate(0deg)' : 'rotate(-135deg)';
    }

    window.toggleFaturasPlanejamentoMobile = function () {
        if (typeof fecharOutrosPlanejamento === 'function') fecharOutrosPlanejamento('card-faturas-acordeon');
        const card = document.getElementById('card-faturas-acordeon');
        if (!card) return;
        card.classList.toggle('expanded');
        atualizarSeta('card-faturas-acordeon', 'faturas-toggle-icon');
        if (card.classList.contains('expanded') && typeof renderizarPlanejadorFaturas === 'function') {
            window.setTimeout(renderizarPlanejadorFaturas, 80);
        }
    };

    window.toggleCalendarioPlanejamentoMobile = function () {
        if (typeof fecharOutrosPlanejamento === 'function') fecharOutrosPlanejamento('card-calendario-acordeon');
        const card = document.getElementById('card-calendario-acordeon');
        if (!card) return;
        card.classList.toggle('expanded');
        atualizarSeta('card-calendario-acordeon', 'calendario-mobile-toggle-icon');
        if (card.classList.contains('expanded')) {
            window.setTimeout(() => window.renderizarCalendarioFinanceiroMobile(), 80);
        }
    };

    function itensDoMes(mes, ano, filtro = 'todos') {
        const entradas = (filtro === 'todos' || filtro === 'entradas') && typeof obterEntradasDoMesCalendario === 'function'
            ? obterEntradasDoMesCalendario(mes, ano)
            : [];
        const gastos = filtro !== 'entradas' && filtro !== 'vencimentos' && typeof obterGastosDoMesCalendario === 'function'
            ? obterGastosDoMesCalendario(mes, ano, filtro)
            : [];
        const vencimentos = (filtro === 'todos' || filtro === 'vencimentos') && typeof obterVencimentosDividasDoMesCalendario === 'function'
            ? obterVencimentosDividasDoMesCalendario(mes, ano)
            : [];
        return [...gastos, ...entradas, ...vencimentos].sort((a, b) => a.data - b.data);
    }

    function categoriaMarcador(item) {
        if (item.tipo === 'entrada') return 'entrada';
        if (item.tipo === 'terceiro') return 'terceiro';
        if (item.tipo === 'vencimento-divida') return 'vencimento';
        return 'gasto';
    }

    function atualizarDiaSelecionado(mes, ano) {
        const periodo = `${ano}-${mes}`;
        if (periodo !== periodoRenderizado) {
            diaSelecionado = Math.min(new Date().getDate(), new Date(ano, mes + 1, 0).getDate());
            periodoRenderizado = periodo;
        }
    }

    function renderizarListaDia(mes, ano, itensFiltrados) {
        const lista = document.getElementById('mobile-calendar-day-list');
        const titulo = document.getElementById('mobile-calendar-day-title');
        const dataSelecionada = new Date(ano, mes, diaSelecionado, 12);
        const dataExtensa = dataSelecionada.toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'long', year: 'numeric', weekday: 'long'
        });
        const cabecalho = document.getElementById('mobile-calendar-selected-date');
        if (cabecalho) cabecalho.textContent = dataExtensa;
        if (titulo) titulo.textContent = `${diaSelecionado} de ${dataSelecionada.toLocaleDateString('pt-BR', { month: 'long' })}`;
        if (!lista) return;

        const itensDia = itensFiltrados.filter(item => item.dia === diaSelecionado);
        if (!itensDia.length) {
            lista.innerHTML = '<div class="mobile-calendar-empty">Nenhum movimento neste dia.</div>';
            return;
        }

        lista.innerHTML = itensDia.map((item, indice) => `
            <button type="button" class="mobile-calendar-entry is-${categoriaMarcador(item)}" data-mobile-calendar-item="${indice}">
                <span class="mobile-calendar-entry-dot" aria-hidden="true"></span>
                <span class="mobile-calendar-entry-copy">
                    <strong>${escaparHtml(item.nome || 'Movimento')}</strong>
                    <small>${escaparHtml(FILTROS[item.tipo === 'terceiro' ? 'terceiros' : item.tipo === 'entrada' ? 'entradas' : item.tipo === 'vencimento-divida' ? 'vencimentos' : 'gastos'])}</small>
                </span>
                <span class="mobile-calendar-entry-value">${typeof formatarMoedaCalendario === 'function' ? formatarMoedaCalendario(item.valor) : `R$ ${Number(item.valor || 0).toFixed(2)}`}</span>
            </button>
        `).join('');

        lista.querySelectorAll('[data-mobile-calendar-item]').forEach(botao => {
            botao.addEventListener('click', () => {
                const item = itensDia[Number(botao.dataset.mobileCalendarItem)];
                if (!item || typeof abrirItemCalendario !== 'function') return;
                abrirItemCalendario(item.tipo, item.index);
            });
        });
    }

    window.selecionarDiaCalendarioMobile = function (dia) {
        diaSelecionado = Number(dia) || 1;
        if (typeof feedbackTatil === 'function') feedbackTatil('leve');
        window.renderizarCalendarioFinanceiroMobile();
    };

    window.selecionarFiltroCalendarioMobile = function (filtro) {
        filtroAtivo = Object.prototype.hasOwnProperty.call(FILTROS, filtro) ? filtro : 'todos';
        const menu = document.getElementById('mobile-calendar-filter-menu');
        if (menu) menu.open = false;
        if (typeof feedbackTatil === 'function') feedbackTatil('leve');
        window.renderizarCalendarioFinanceiroMobile();
    };

    window.renderizarCalendarioFinanceiroMobile = function () {
        const grid = document.getElementById('mobile-financial-calendar-grid');
        if (!grid || typeof dataFiltro === 'undefined') return;
        const mes = dataFiltro.getMonth();
        const ano = dataFiltro.getFullYear();
        atualizarDiaSelecionado(mes, ano);

        const totalDias = new Date(ano, mes + 1, 0).getDate();
        const inicioSemana = new Date(ano, mes, 1).getDay();
        const todosItens = itensDoMes(mes, ano, 'todos');
        const itensFiltrados = itensDoMes(mes, ano, filtroAtivo);
        const marcadoresPorDia = {};
        todosItens.forEach(item => {
            if (!marcadoresPorDia[item.dia]) marcadoresPorDia[item.dia] = new Set();
            marcadoresPorDia[item.dia].add(categoriaMarcador(item));
        });

        const hoje = new Date();
        const mesAtual = hoje.getMonth() === mes && hoje.getFullYear() === ano;
        let html = Array.from({ length: inicioSemana }, () => '<span class="mobile-calendar-day is-empty" aria-hidden="true"></span>').join('');
        for (let dia = 1; dia <= totalDias; dia += 1) {
            const marcadores = [...(marcadoresPorDia[dia] || [])];
            const atual = mesAtual && hoje.getDate() === dia;
            const selecionado = diaSelecionado === dia;
            html += `
                <button type="button" class="mobile-calendar-day${atual ? ' is-today' : ''}${selecionado ? ' is-selected' : ''}" onclick="selecionarDiaCalendarioMobile(${dia})" aria-label="Dia ${dia}" aria-pressed="${selecionado}">
                    <span>${dia}</span>
                    <span class="mobile-calendar-markers" aria-hidden="true">${marcadores.map(tipo => `<i class="is-${tipo}"></i>`).join('')}</span>
                </button>`;
        }
        grid.innerHTML = html;

        const label = document.getElementById('mobile-calendar-filter-label');
        if (label) label.textContent = FILTROS[filtroAtivo];
        document.querySelectorAll('[data-mobile-calendar-filter]').forEach(botao => {
            botao.classList.toggle('active', botao.dataset.mobileCalendarFilter === filtroAtivo);
        });
        renderizarListaDia(mes, ano, itensFiltrados);
    };
})();
