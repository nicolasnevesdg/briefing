/* ========================================================= */
/* INTEGRIDADE DOS DADOS - DIAGNÓSTICO LOCAL DE LANÇAMENTOS */
/* ========================================================= */

let listaIntegridadeDadosAberta = false;

function escaparHtmlIntegridade(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[caractere]);
}

function dataIsoValidaIntegridade(valor) {
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

function rotuloTipoIntegridade(tipo) {
    return ({
        cartao: 'Crédito',
        debito: 'Débito, Pix ou dinheiro',
        fixo: 'Gasto fixo'
    })[tipo] || 'Tipo desconhecido';
}

function moedaIntegridade(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return 'Valor inválido';
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function analisarIntegridadeTransacoes() {
    const transacoes = Array.isArray(salsiData?.transacoes) ? salsiData.transacoes : [];

    return transacoes.map((transacao, index) => {
        const problemas = [];
        const dataTexto = String(transacao?.dataCompra || '').trim();
        const valorTotal = Number(transacao?.valorTotal);
        const parcelas = Number(transacao?.parcelas);
        const tiposValidos = ['cartao', 'debito', 'fixo'];

        if (!dataTexto) {
            problemas.push({ chave: 'data', rotulo: 'Data ausente', nivel: 'critico' });
        } else if (!dataIsoValidaIntegridade(dataTexto)) {
            problemas.push({ chave: 'data', rotulo: 'Data inválida', nivel: 'critico' });
        }

        if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
            problemas.push({ chave: 'valor', rotulo: 'Valor inválido', nivel: 'critico' });
        }

        if (!Number.isInteger(parcelas) || parcelas < 1) {
            problemas.push({ chave: 'parcelas', rotulo: 'Parcelas inválidas', nivel: 'critico' });
        }

        if (!tiposValidos.includes(transacao?.tipo)) {
            problemas.push({ chave: 'tipo', rotulo: 'Tipo não reconhecido', nivel: 'critico' });
        }

        if (transacao?.tipo === 'cartao') {
            const valorParcela = Number(transacao?.valorParcela);
            if (!Number.isFinite(valorParcela) || valorParcela <= 0) {
                problemas.push({ chave: 'valorParcela', rotulo: 'Valor da parcela inválido', nivel: 'critico' });
            }
        }

        if (!String(transacao?.nome || '').trim()) {
            problemas.push({ chave: 'nome', rotulo: 'Nome ausente', nivel: 'aviso' });
        }

        if (!String(transacao?.categoria || '').trim()) {
            problemas.push({ chave: 'categoria', rotulo: 'Categoria ausente', nivel: 'aviso' });
        }

        if (['cartao', 'debito'].includes(transacao?.tipo) && !String(transacao?.banco || '').trim()) {
            problemas.push({ chave: 'banco', rotulo: 'Conta ou cartão ausente', nivel: 'aviso' });
        }

        return { index, transacao, problemas };
    }).filter(item => item.problemas.length > 0);
}

function itemIntegridadeHtml(item) {
    const transacao = item.transacao || {};
    const nome = String(transacao.nome || '').trim() || 'Lançamento sem nome';
    const data = dataIsoValidaIntegridade(transacao.dataCompra)
        ? new Date(`${transacao.dataCompra}T12:00:00`).toLocaleDateString('pt-BR')
        : 'Sem data válida';
    const temCritico = item.problemas.some(problema => problema.nivel === 'critico');
    const etiquetas = item.problemas.map(problema => `
        <span class="data-integrity-issue is-${problema.nivel}">${escaparHtmlIntegridade(problema.rotulo)}</span>
    `).join('');

    return `
        <article class="data-integrity-item ${temCritico ? 'has-critical' : ''}">
            <div class="data-integrity-item-main">
                <div class="data-integrity-item-title">
                    <strong>${escaparHtmlIntegridade(nome)}</strong>
                    <span>${escaparHtmlIntegridade(moedaIntegridade(transacao.valorTotal))}</span>
                </div>
                <div class="data-integrity-item-meta">
                    <span>${escaparHtmlIntegridade(rotuloTipoIntegridade(transacao.tipo))}</span>
                    <i aria-hidden="true"></i>
                    <span>${escaparHtmlIntegridade(data)}</span>
                </div>
                <div class="data-integrity-issues">${etiquetas}</div>
            </div>
            <button type="button" onclick="corrigirLancamentoIntegridade(${item.index})">
                Corrigir <i class="fi fi-rr-arrow-small-right" aria-hidden="true"></i>
            </button>
        </article>`;
}

function renderizarIntegridadeDados() {
    const card = document.querySelector('.data-integrity-card');
    const status = document.getElementById('data-integrity-status');
    const count = document.getElementById('data-integrity-count');
    const descricao = document.getElementById('data-integrity-description');
    const toggle = document.getElementById('data-integrity-toggle');
    const detalhes = document.getElementById('data-integrity-details');
    const lista = document.getElementById('data-integrity-list');
    if (!card || !status || !count || !descricao || !toggle || !detalhes || !lista) return;

    const problemas = analisarIntegridadeTransacoes();
    const criticos = problemas.filter(item => item.problemas.some(problema => problema.nivel === 'critico')).length;

    status.classList.remove('is-checking', 'is-ok', 'has-warning');
    if (!problemas.length) {
        status.classList.add('is-ok');
        status.textContent = 'Tudo certo';
        count.textContent = 'Nenhum lançamento precisa de revisão';
        descricao.textContent = 'Datas, valores e informações essenciais estão consistentes.';
        toggle.hidden = true;
        detalhes.hidden = true;
        lista.innerHTML = '';
        listaIntegridadeDadosAberta = false;
        return;
    }

    status.classList.add('has-warning');
    status.textContent = `${problemas.length} para revisar`;
    count.textContent = `${problemas.length} lançamento${problemas.length === 1 ? '' : 's'} precisa${problemas.length === 1 ? '' : 'm'} de atenção`;
    descricao.textContent = criticos > 0
        ? `${criticos} ${criticos === 1 ? 'pode' : 'podem'} afetar os cálculos. Nada será corrigido sem sua confirmação.`
        : 'Os cálculos continuam funcionando, mas faltam informações em alguns itens.';
    toggle.hidden = false;
    toggle.textContent = listaIntegridadeDadosAberta ? 'Ocultar lançamentos' : 'Ver lançamentos';
    detalhes.hidden = !listaIntegridadeDadosAberta;
    lista.innerHTML = problemas.map(itemIntegridadeHtml).join('');
}

function alternarListaIntegridadeDados() {
    listaIntegridadeDadosAberta = !listaIntegridadeDadosAberta;
    renderizarIntegridadeDados();
}

function corrigirLancamentoIntegridade(index) {
    if (!Number.isInteger(Number(index)) || !salsiData?.transacoes?.[Number(index)]) return;
    if (typeof editarGasto === 'function') {
        editarGasto(Number(index));
        return;
    }
    if (typeof mostrarToast === 'function') mostrarToast('Não foi possível abrir este lançamento.');
}

function abrirIntegridadeDados() {
    listaIntegridadeDadosAberta = true;
    if (typeof irParaConfiguracoes === 'function') irParaConfiguracoes('dados');
    renderizarIntegridadeDados();
    requestAnimationFrame(() => {
        document.querySelector('.data-integrity-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

window.analisarIntegridadeTransacoes = analisarIntegridadeTransacoes;
window.renderizarIntegridadeDados = renderizarIntegridadeDados;
window.alternarListaIntegridadeDados = alternarListaIntegridadeDados;
window.corrigirLancamentoIntegridade = corrigirLancamentoIntegridade;
window.abrirIntegridadeDados = abrirIntegridadeDados;
