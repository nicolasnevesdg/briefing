/* ========================================================= */
/* CAIXINHAS MÚLTIPLAS - GERAL, SECUNDÁRIAS E PLANOS          */
/* ========================================================= */

const CAIXINHA_GERAL_ID = 'geral';
let sincronizacaoCaixinhasTimer = null;
let sincronizacaoCaixinhasEmAndamento = false;
let sincronizacaoCaixinhasPendente = false;
let salvandoConfigCaixinha = false;

function gerarIdCaixinha(prefixo = 'cx') {
    return `${prefixo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function agendarPersistenciaEstruturaCaixinhas() {
    persistirCaixinhas();
}

function garantirEstruturaCaixinhas() {
    if (!salsiData || typeof salsiData !== 'object') return [];
    let alterou = false;

    if (!Array.isArray(salsiData.caixinha)) {
        salsiData.caixinha = [];
        alterou = true;
    }
    if (!Array.isArray(salsiData.caixinhas)) {
        salsiData.caixinhas = [];
        alterou = true;
    }
    if (!Array.isArray(salsiData.desejos)) {
        salsiData.desejos = [];
        alterou = true;
    }
    if (!Array.isArray(salsiData.metas)) {
        salsiData.metas = [];
        alterou = true;
    }

    let geral = salsiData.caixinhas.find(item => String(item.id) === CAIXINHA_GERAL_ID || item.geral === true);
    if (!geral) {
        geral = {
            id: CAIXINHA_GERAL_ID,
            nome: 'Caixinha Geral',
            descricao: 'Reserva principal da conta',
            meta: null,
            geral: true,
            criadaEm: new Date().toISOString()
        };
        salsiData.caixinhas.unshift(geral);
        alterou = true;
    } else {
        if (geral.id !== CAIXINHA_GERAL_ID) {
            geral.id = CAIXINHA_GERAL_ID;
            alterou = true;
        }
        geral.geral = true;
        geral.nome = geral.nome || 'Caixinha Geral';
    }

    salsiData.caixinha.forEach(movimento => {
        if (!movimento.caixinhaId) {
            movimento.caixinhaId = CAIXINHA_GERAL_ID;
            alterou = true;
        }
    });

    salsiData.desejos.forEach(desejo => {
        if (!desejo.id) {
            desejo.id = gerarIdCaixinha('desejo');
            alterou = true;
        }
    });

    if (!salsiData.config) salsiData.config = {};
    if (salsiData.config.caixinhasMigradasV1 !== true) {
        salsiData.config.caixinhasMigradasV1 = true;
        alterou = true;
    }

    if (alterou) agendarPersistenciaEstruturaCaixinhas();
    return salsiData.caixinhas;
}

function garantirEstruturaCaixinha() {
    garantirEstruturaCaixinhas();
}

function obterCaixinhaPorId(id) {
    return garantirEstruturaCaixinhas().find(item => String(item.id) === String(id || CAIXINHA_GERAL_ID))
        || garantirEstruturaCaixinhas()[0];
}

function movimentoSomaNaCaixinha(movimento) {
    return movimento?.tipo === 'entrada' || movimento?.tipo === 'transferencia-entrada';
}

function calcularSaldoCaixinha(caixinhaId = null) {
    garantirEstruturaCaixinhas();
    return salsiData.caixinha.reduce((total, movimento) => {
        if (caixinhaId && String(movimento.caixinhaId || CAIXINHA_GERAL_ID) !== String(caixinhaId)) return total;
        const valor = Number(movimento.valor || 0);
        return total + (movimentoSomaNaCaixinha(movimento) ? valor : -valor);
    }, 0);
}

function preencherSelectCaixinhas(selectOuId, selecionada = CAIXINHA_GERAL_ID, opcoes = {}) {
    const select = typeof selectOuId === 'string' ? document.getElementById(selectOuId) : selectOuId;
    if (!select) return;
    const excluir = String(opcoes.excluir || '');
    const caixinhas = garantirEstruturaCaixinhas().filter(item => !item.arquivada && (!excluir || String(item.id) !== excluir));
    select.innerHTML = caixinhas.map(item => `
        <option value="${item.id}">${escaparHtmlCarteira(item.nome)} · ${moedaVisual(calcularSaldoCaixinha(item.id))}</option>
    `).join('');
    if (caixinhas.some(item => String(item.id) === String(selecionada))) select.value = String(selecionada);
}

function executarSincronizacaoCaixinhas() {
    sincronizacaoCaixinhasTimer = null;
    if (sincronizacaoCaixinhasEmAndamento) {
        sincronizacaoCaixinhasPendente = true;
        return;
    }
    if (typeof salvarNoFirebase !== 'function') return;

    sincronizacaoCaixinhasPendente = false;
    sincronizacaoCaixinhasEmAndamento = true;
    Promise.resolve()
        .then(() => salvarNoFirebase())
        .catch(error => console.error('Erro ao sincronizar caixinhas:', error))
        .finally(() => {
            sincronizacaoCaixinhasEmAndamento = false;
            if (sincronizacaoCaixinhasPendente) {
                sincronizacaoCaixinhasTimer = setTimeout(executarSincronizacaoCaixinhas, 120);
            }
        });
}

function agendarSincronizacaoCaixinhas() {
    sincronizacaoCaixinhasPendente = true;
    if (sincronizacaoCaixinhasTimer) clearTimeout(sincronizacaoCaixinhasTimer);
    sincronizacaoCaixinhasTimer = setTimeout(executarSincronizacaoCaixinhas, 220);
}

function persistirCaixinhas() {
    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
    agendarSincronizacaoCaixinhas();
}

function renderizarCardCaixinha(caixinha) {
    const saldo = calcularSaldoCaixinha(caixinha.id);
    const meta = Number(caixinha.meta || 0);
    const percentual = meta > 0 ? Math.min(100, Math.round((saldo / meta) * 100)) : 0;
    const desejo = (salsiData.desejos || []).find(item => String(item.id) === String(caixinha.desejoId || ''));
    const geral = caixinha.geral === true;

    return `
        <article class="caixinha-account-card ${geral ? 'is-general' : ''} ${meta > 0 ? 'has-goal' : ''}" id="caixinha-card-${caixinha.id}">
            <div class="caixinha-account-top">
                <span class="caixinha-account-icon"><i class="fi ${geral ? 'fi-rr-piggy-bank' : 'fi-rr-box-open'}"></i></span>
                <div>
                    <small>${geral ? 'Padrão da conta' : (desejo ? 'Vinculada a desejo' : (meta > 0 ? 'Com meta' : 'Sem meta'))}</small>
                    <strong>${escaparHtmlCarteira(caixinha.nome)}</strong>
                </div>
            </div>
            <div class="caixinha-account-value">
                <span>Saldo</span>
                <strong>${moedaVisual(saldo)}</strong>
            </div>
            ${meta > 0 ? `
                <div class="caixinha-goal">
                    <div><span>${percentual}%</span><small>${moedaVisual(saldo)} de ${moedaVisual(meta)}</small></div>
                    <div class="caixinha-goal-track"><span style="width:${percentual}%"></span></div>
                    <small>${saldo >= meta ? 'Meta alcançada' : `Faltam ${moedaVisual(Math.max(0, meta - saldo))}`}</small>
                </div>
            ` : `<p class="caixinha-account-desc">${escaparHtmlCarteira(caixinha.descricao || 'Dinheiro separado sem uma meta de valor.')}</p>`}
            <div class="caixinha-account-actions">
                <button type="button" onclick="abrirModalCaixinha('entrada', '${caixinha.id}')">Adicionar</button>
                <button type="button" onclick="abrirModalCaixinha('saida', '${caixinha.id}')">Retirar</button>
                ${geral ? '' : `<button type="button" onclick="abrirModalConfigCaixinha('${caixinha.id}')">Editar</button>
                    <button type="button" class="danger" onclick="excluirCaixinhaSecundaria('${caixinha.id}')">Excluir</button>`}
            </div>
        </article>
    `;
}

function renderizarVisualCaixinha() {
    const caixinhas = garantirEstruturaCaixinhas().filter(item => !item.arquivada);
    const lista = document.getElementById('visual-lista-caixinha');
    const grid = document.getElementById('visual-grid-caixinhas');
    const saldoHeader = document.getElementById('visual-caixinha-saldo');
    const saldoPrincipal = document.getElementById('caixinha-saldo-principal');
    const saldoTotal = calcularSaldoCaixinha();

    if (saldoHeader) saldoHeader.textContent = moedaVisual(saldoTotal);
    if (saldoPrincipal) saldoPrincipal.textContent = moedaVisual(saldoTotal);
    if (grid) grid.innerHTML = caixinhas.map(renderizarCardCaixinha).join('');
    renderizarDesejosDetalhadosCaixinha();
    renderizarMetasAntigasDetalhadasCaixinha();
    if (!lista) return;

    const movimentos = [...salsiData.caixinha]
        .filter(movimento => movimento.tipo !== 'transferencia-entrada')
        .sort((a, b) => new Date((b.data || '') + 'T12:00:00') - new Date((a.data || '') + 'T12:00:00'));

    lista.innerHTML = movimentos.length ? movimentos.map(movimento => {
        const transferencia = movimento.tipo === 'transferencia-saida';
        const caixinha = obterCaixinhaPorId(movimento.caixinhaId);
        const destino = transferencia ? obterCaixinhaPorId(movimento.caixinhaDestinoId) : null;
        const entrada = movimentoSomaNaCaixinha(movimento);
        const kicker = transferencia ? 'Transferência interna' : (entrada ? 'Valor guardado' : 'Retirada');
        const badge = transferencia ? `${caixinha.nome} → ${destino?.nome || 'Outra caixinha'}` : caixinha.nome;

        return `
            <div class="visual-card caixinha-history-card">
                <div class="visual-card-main">
                    <span class="visual-item-kicker">${kicker}</span>
                    <div class="visual-card-title">
                        <span>${escaparHtmlCarteira(movimento.nome || kicker)}</span>
                        <small class="visual-badge ${entrada ? '' : 'muted'}">${escaparHtmlCarteira(badge)}</small>
                    </div>
                    <div class="visual-card-meta">
                        <span>${dataVisual(movimento.data)}</span>
                        ${movimento.descricao ? `<span>${escaparHtmlCarteira(movimento.descricao)}</span>` : ''}
                        ${movimento.comprovanteUrl ? `<span>Comprovante anexado</span>` : ''}
                    </div>
                </div>
                <div class="visual-card-value">
                    <strong>${transferencia ? '' : (entrada ? '+' : '- ')}${moedaVisual(movimento.valor || 0)}</strong>
                    <div class="visual-card-actions">
                        ${movimento.comprovanteUrl ? `<button type="button" class="visual-mini-btn" onclick="abrirComprovanteCaixinha('${movimento.comprovanteUrl}')">Comprovante</button>` : ''}
                        ${transferencia
                            ? `<button type="button" class="visual-mini-btn danger" onclick="excluirTransferenciaCaixinha('${movimento.transferenciaId}')">Desfazer</button>`
                            : `<button type="button" class="visual-mini-btn" onclick="editarMovimentoCaixinha('${movimento.id}')">Editar</button>
                               <button type="button" class="visual-mini-btn danger" onclick="excluirMovimentoCaixinha('${movimento.id}')">Apagar</button>`}
                    </div>
                </div>
            </div>
        `;
    }).join('') : '<div class="visual-empty">Suas caixinhas ainda estão vazias. Adicione dinheiro à Geral ou crie uma caixinha secundária.</div>';
}

function abrirModalCaixinha(tipo = 'entrada', caixinhaId = CAIXINHA_GERAL_ID) {
    garantirEstruturaCaixinhas();
    const modal = document.getElementById('modal-caixinha');
    if (!modal) return;
    const isSaida = tipo === 'saida';
    const hoje = new Date().toISOString().split('T')[0];
    const caixinha = obterCaixinhaPorId(caixinhaId);

    document.getElementById('caixinha-tipo').value = isSaida ? 'saida' : 'entrada';
    document.getElementById('caixinha-id').value = '';
    preencherSelectCaixinhas('caixinha-destino', caixinha.id);
    document.getElementById('caixinha-destino').disabled = false;
    document.getElementById('caixinha-nome').value = '';
    document.getElementById('caixinha-valor').value = '';
    document.getElementById('caixinha-data').value = hoje;
    document.getElementById('caixinha-descricao').value = '';
    document.getElementById('caixinha-comprovante').value = '';

    const status = document.getElementById('caixinha-comprovante-status');
    if (status) status.textContent = 'Nenhum comprovante anexado';
    document.getElementById('caixinha-modal-kicker').textContent = isSaida ? 'Resgatar reserva' : 'Guardar dinheiro';
    document.getElementById('caixinha-modal-title').textContent = isSaida ? `Retirar de ${caixinha.nome}` : `Adicionar a ${caixinha.nome}`;
    document.getElementById('caixinha-modal-desc').textContent = isSaida
        ? `Saldo disponível: ${moedaVisual(calcularSaldoCaixinha(caixinha.id))}. O resgate não cria um gasto.`
        : 'O valor guardado reduz o dinheiro disponível do mês e aumenta o saldo desta caixinha.';
    document.getElementById('btn-save-caixinha').textContent = isSaida ? 'Salvar retirada' : 'Guardar valor';
    modal.showModal();
    document.getElementById('caixinha-nome')?.focus();
}

function editarMovimentoCaixinha(id) {
    garantirEstruturaCaixinhas();
    const movimento = salsiData.caixinha.find(item => String(item.id) === String(id));
    const modal = document.getElementById('modal-caixinha');
    if (!movimento || !modal || String(movimento.tipo).startsWith('transferencia')) return;
    const isSaida = movimento.tipo === 'saida';

    document.getElementById('caixinha-id').value = movimento.id;
    document.getElementById('caixinha-tipo').value = movimento.tipo;
    preencherSelectCaixinhas('caixinha-destino', movimento.caixinhaId || CAIXINHA_GERAL_ID);
    document.getElementById('caixinha-destino').disabled = false;
    document.getElementById('caixinha-nome').value = movimento.nome || '';
    document.getElementById('caixinha-valor').value = valorParaCampoMoeda(movimento.valor);
    formatarMoeda(document.getElementById('caixinha-valor'));
    document.getElementById('caixinha-data').value = movimento.data || new Date().toISOString().split('T')[0];
    document.getElementById('caixinha-descricao').value = movimento.descricao || '';
    document.getElementById('caixinha-comprovante').value = '';
    const status = document.getElementById('caixinha-comprovante-status');
    if (status) status.textContent = movimento.comprovanteUrl ? 'Comprovante atual mantido' : 'Nenhum comprovante anexado';
    document.getElementById('caixinha-modal-kicker').textContent = 'Editar movimento';
    document.getElementById('caixinha-modal-title').textContent = isSaida ? 'Editar retirada' : 'Editar valor guardado';
    document.getElementById('caixinha-modal-desc').textContent = isSaida
        ? 'Ajuste a retirada ou a caixinha de origem.'
        : 'Ajuste o registro e o gasto vinculado.';
    document.getElementById('btn-save-caixinha').textContent = 'Salvar alterações';
    modal.showModal();
}

function sincronizarTransacaoMovimentoCaixinha(movimento) {
    salsiData.transacoes = (salsiData.transacoes || []).filter(transacao => {
        return !(transacao.origemCaixinha && String(transacao.caixinhaId) === String(movimento.id));
    });
    if (movimento.tipo !== 'entrada') return;
    if (!Array.isArray(salsiData.config.categorias)) salsiData.config.categorias = [];
    if (!salsiData.config.categorias.includes('Caixinha')) salsiData.config.categorias.push('Caixinha');
    const caixinha = obterCaixinhaPorId(movimento.caixinhaId);

    salsiData.transacoes.push({
        nome: `Caixinha - ${movimento.nome}`,
        tipo: 'debito',
        valorTotal: movimento.valor,
        valorParcela: movimento.valor,
        parcelas: 1,
        dataCompra: movimento.data,
        banco: caixinha.nome,
        categoria: 'Caixinha',
        observacao: movimento.descricao,
        pago: true,
        delayPagamento: 0,
        eDeTerceiro: false,
        nomeTerceiro: '',
        terceiro: null,
        formaPagamento: 'Caixinha',
        comprovanteUrl: movimento.comprovanteUrl || '',
        origemCaixinha: true,
        caixinhaId: movimento.id,
        caixinhaDestinoId: movimento.caixinhaId,
        criadoEm: movimento.criadoEm || movimento.id,
        destaqueAte: Date.now() + (5 * 60 * 1000)
    });
}

function salvarMovimentoCaixinhaAPartirDoGasto({ nome, valor, data, descricao = '', comprovanteUrl = '', indexEdit = -1 }) {
    garantirEstruturaCaixinhas();
    const gastoAnterior = indexEdit >= 0 ? salsiData.transacoes[indexEdit] : null;
    const id = gastoAnterior?.caixinhaId || Date.now();
    const movimentoAnterior = salsiData.caixinha.find(item => String(item.id) === String(id));
    const movimento = {
        id,
        tipo: 'entrada',
        caixinhaId: gastoAnterior?.caixinhaDestinoId || movimentoAnterior?.caixinhaId || CAIXINHA_GERAL_ID,
        nome: nome || 'Valor guardado',
        valor: Number(valor) || 0,
        data: data || new Date().toISOString().split('T')[0],
        descricao,
        comprovanteUrl,
        criadoEm: movimentoAnterior?.criadoEm || id
    };
    const indice = salsiData.caixinha.findIndex(item => String(item.id) === String(id));
    if (indice >= 0) salsiData.caixinha[indice] = movimento;
    else salsiData.caixinha.push(movimento);
    sincronizarTransacaoMovimentoCaixinha(movimento);
    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
    if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
}

async function salvarMovimentoCaixinha() {
    garantirEstruturaCaixinhas();
    const tipo = document.getElementById('caixinha-tipo')?.value === 'saida' ? 'saida' : 'entrada';
    const idEdit = document.getElementById('caixinha-id')?.value || '';
    const indexEdit = salsiData.caixinha.findIndex(item => String(item.id) === String(idEdit));
    const anterior = indexEdit >= 0 ? salsiData.caixinha[indexEdit] : null;
    const caixinhaId = document.getElementById('caixinha-destino')?.value || CAIXINHA_GERAL_ID;
    const nome = document.getElementById('caixinha-nome')?.value.trim() || (tipo === 'saida' ? 'Retirada da caixinha' : 'Valor guardado');
    const valor = parseMoedaVisual(document.getElementById('caixinha-valor')?.value);
    const data = document.getElementById('caixinha-data')?.value || new Date().toISOString().split('T')[0];
    const descricao = document.getElementById('caixinha-descricao')?.value.trim() || '';
    const fileInput = document.getElementById('caixinha-comprovante');
    const btn = document.getElementById('btn-save-caixinha');

    if (valor <= 0) {
        alert('Informe um valor válido.');
        return;
    }
    if (tipo === 'saida') {
        let disponivel = calcularSaldoCaixinha(caixinhaId);
        if (anterior?.tipo === 'saida' && String(anterior.caixinhaId) === String(caixinhaId)) disponivel += Number(anterior.valor || 0);
        if (valor > disponivel + 0.005) {
            alert(`Esta caixinha possui ${moedaVisual(disponivel)} disponíveis.`);
            return;
        }
    }

    let comprovanteUrl = anterior?.comprovanteUrl || '';
    const textoOriginal = btn?.textContent || '';
    try {
        if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
        if (fileInput?.files?.length) comprovanteUrl = await enviarComprovanteCaixinha(fileInput.files[0]);
        const id = anterior?.id || Date.now();
        const movimento = {
            id,
            tipo,
            caixinhaId,
            nome,
            valor,
            data,
            descricao,
            comprovanteUrl,
            criadoEm: anterior?.criadoEm || id
        };
        if (indexEdit >= 0) salsiData.caixinha[indexEdit] = movimento;
        else salsiData.caixinha.push(movimento);
        sincronizarTransacaoMovimentoCaixinha(movimento);
        await persistirCaixinhas();
        document.getElementById('modal-caixinha')?.close();
        if (typeof renderizar === 'function') renderizar();
        if (typeof renderizarVisualizacoes === 'function') renderizarVisualizacoes();
        if (typeof mostrarToast === 'function') mostrarToast(tipo === 'saida' ? 'Retirada registrada.' : 'Valor guardado na caixinha.');
    } catch (error) {
        console.error('Erro ao salvar caixinha:', error);
        alert('Não foi possível salvar o movimento: ' + error.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }
    }
}

async function excluirMovimentoCaixinha(id) {
    garantirEstruturaCaixinhas();
    const movimento = salsiData.caixinha.find(item => String(item.id) === String(id));
    if (!movimento || !confirm(`Apagar "${movimento.nome || 'movimento da caixinha'}"?`)) return;
    salsiData.caixinha = salsiData.caixinha.filter(item => String(item.id) !== String(id));
    salsiData.transacoes = (salsiData.transacoes || []).filter(item => !(item.origemCaixinha && String(item.caixinhaId) === String(id)));
    await persistirCaixinhas();
    if (typeof renderizar === 'function') renderizar();
    if (typeof renderizarVisualizacoes === 'function') renderizarVisualizacoes();
    if (typeof mostrarToast === 'function') mostrarToast('Movimento apagado.');
}

function abrirModalConfigCaixinha(id = '') {
    garantirEstruturaCaixinhas();
    const caixinha = id ? obterCaixinhaPorId(id) : null;
    if (caixinha?.geral) return;
    const modal = document.getElementById('modal-config-caixinha');
    if (!modal) return;
    document.getElementById('config-caixinha-id').value = caixinha?.id || '';
    document.getElementById('config-caixinha-title').textContent = caixinha ? 'Editar caixinha' : 'Nova caixinha';
    document.getElementById('config-caixinha-nome').value = caixinha?.nome || '';
    document.getElementById('config-caixinha-meta').value = caixinha?.meta ? valorParaCampoMoeda(caixinha.meta) : '';
    document.getElementById('config-caixinha-descricao').value = caixinha?.descricao || '';
    const btnSalvar = document.getElementById('btn-save-config-caixinha');
    if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar caixinha';
    }

    const selectDesejo = document.getElementById('config-caixinha-desejo');
    const desejos = salsiData.desejos || [];
    selectDesejo.innerHTML = '<option value="">Nenhum desejo</option>' + desejos
        .filter(desejo => {
            const vinculada = salsiData.caixinhas.find(item => String(item.desejoId) === String(desejo.id));
            return !vinculada || String(vinculada.id) === String(caixinha?.id || '');
        })
        .map(desejo => `<option value="${desejo.id}">${escaparHtmlCarteira(desejo.nome)} · ${moedaVisual(desejo.valor)}</option>`)
        .join('');
    selectDesejo.value = caixinha?.desejoId || '';
    modal.showModal();
    document.getElementById('config-caixinha-nome')?.focus();
}

async function salvarConfigCaixinha() {
    const btnSalvar = document.getElementById('btn-save-config-caixinha');
    if (salvandoConfigCaixinha || btnSalvar?.disabled) return;
    const caixinhas = garantirEstruturaCaixinhas();
    const id = document.getElementById('config-caixinha-id').value;
    const existente = id ? caixinhas.find(item => String(item.id) === String(id)) : null;
    const nome = document.getElementById('config-caixinha-nome').value.trim();
    const metaTexto = document.getElementById('config-caixinha-meta').value.trim();
    const desejoId = document.getElementById('config-caixinha-desejo').value;
    const desejo = (salsiData.desejos || []).find(item => String(item.id) === String(desejoId));
    const metaInformada = metaTexto ? parseMoedaVisual(metaTexto) : 0;
    const meta = metaInformada > 0 ? metaInformada : (desejo ? Number(desejo.valor || 0) : null);
    if (!nome) {
        alert('Dê um nome para a caixinha.');
        return;
    }

    salvandoConfigCaixinha = true;
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.textContent = 'Salvando...';
    }

    let concluiu = false;
    try {
        const dados = {
            id: existente?.id || gerarIdCaixinha(),
            nome,
            descricao: document.getElementById('config-caixinha-descricao').value.trim(),
            meta: meta || null,
            desejoId: desejoId || null,
            geral: false,
            criadaEm: existente?.criadaEm || new Date().toISOString(),
            atualizadaEm: new Date().toISOString()
        };
        if (existente) caixinhas[caixinhas.indexOf(existente)] = dados;
        else caixinhas.push(dados);
        persistirCaixinhas();
        concluiu = true;
        document.getElementById('modal-config-caixinha').close();
        if (typeof renderizar === 'function') renderizar();
        if (typeof renderizarVisualizacoes === 'function') renderizarVisualizacoes();
        if (typeof mostrarToast === 'function') mostrarToast(existente ? 'Caixinha atualizada.' : 'Nova caixinha criada.');
    } finally {
        salvandoConfigCaixinha = false;
        if (btnSalvar && !concluiu) {
            btnSalvar.disabled = false;
            btnSalvar.textContent = 'Salvar caixinha';
        }
    }
}

async function excluirCaixinhaSecundaria(id) {
    const caixinha = obterCaixinhaPorId(id);
    if (!caixinha || caixinha.geral) return;
    const saldo = calcularSaldoCaixinha(id);
    if (Math.abs(saldo) > 0.005) {
        alert(`Transfira ou retire os ${moedaVisual(saldo)} antes de excluir esta caixinha.`);
        return;
    }
    if (!confirm(`Excluir a caixinha "${caixinha.nome}"?`)) return;
    caixinha.arquivada = true;
    caixinha.arquivadaEm = new Date().toISOString();
    caixinha.desejoId = null;
    await persistirCaixinhas();
    if (typeof renderizar === 'function') renderizar();
    if (typeof renderizarVisualizacoes === 'function') renderizarVisualizacoes();
}

function abrirModalTransferenciaCaixinha(origemId = CAIXINHA_GERAL_ID, destinoId = '') {
    const caixinhas = garantirEstruturaCaixinhas().filter(item => !item.arquivada);
    if (caixinhas.length < 2) {
        if (typeof mostrarToast === 'function') mostrarToast('Crie uma caixinha secundária para fazer transferências.');
        abrirModalConfigCaixinha();
        return;
    }
    preencherSelectCaixinhas('transferencia-caixinha-origem', origemId);
    const destinoPadrao = destinoId || caixinhas.find(item => String(item.id) !== String(origemId))?.id;
    preencherSelectCaixinhas('transferencia-caixinha-destino', destinoPadrao, { excluir: origemId });
    document.getElementById('transferencia-caixinha-valor').value = '';
    document.getElementById('transferencia-caixinha-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('transferencia-caixinha-descricao').value = '';
    atualizarResumoTransferenciaCaixinha();
    document.getElementById('modal-transferir-caixinha').showModal();
}

function atualizarResumoTransferenciaCaixinha() {
    const origemId = document.getElementById('transferencia-caixinha-origem')?.value || CAIXINHA_GERAL_ID;
    const destino = document.getElementById('transferencia-caixinha-destino');
    preencherSelectCaixinhas(destino, destino?.value, { excluir: origemId });
    const resumo = document.getElementById('transferencia-caixinha-balance');
    if (resumo) resumo.textContent = `Saldo disponível: ${moedaVisual(calcularSaldoCaixinha(origemId))}`;
}

async function salvarTransferenciaCaixinha() {
    const origemId = document.getElementById('transferencia-caixinha-origem').value;
    const destinoId = document.getElementById('transferencia-caixinha-destino').value;
    const valor = parseMoedaVisual(document.getElementById('transferencia-caixinha-valor').value);
    const data = document.getElementById('transferencia-caixinha-data').value || new Date().toISOString().split('T')[0];
    const descricao = document.getElementById('transferencia-caixinha-descricao').value.trim();
    if (!origemId || !destinoId || origemId === destinoId || valor <= 0) {
        alert('Escolha caixinhas diferentes e informe um valor válido.');
        return;
    }
    const saldo = calcularSaldoCaixinha(origemId);
    if (valor > saldo + 0.005) {
        alert(`A caixinha de origem possui ${moedaVisual(saldo)} disponíveis.`);
        return;
    }
    const transferenciaId = gerarIdCaixinha('transf');
    const origem = obterCaixinhaPorId(origemId);
    const destino = obterCaixinhaPorId(destinoId);
    const base = { transferenciaId, valor, data, descricao, criadoEm: new Date().toISOString() };
    salsiData.caixinha.push({
        ...base,
        id: `${transferenciaId}_saida`,
        tipo: 'transferencia-saida',
        caixinhaId: origemId,
        caixinhaDestinoId: destinoId,
        nome: `Transferência para ${destino.nome}`
    });
    salsiData.caixinha.push({
        ...base,
        id: `${transferenciaId}_entrada`,
        tipo: 'transferencia-entrada',
        caixinhaId: destinoId,
        caixinhaOrigemId: origemId,
        nome: `Transferência de ${origem.nome}`
    });
    await persistirCaixinhas();
    document.getElementById('modal-transferir-caixinha').close();
    if (typeof renderizar === 'function') renderizar();
    if (typeof renderizarVisualizacoes === 'function') renderizarVisualizacoes();
    if (typeof mostrarToast === 'function') mostrarToast('Transferência concluída. O total guardado não mudou.');
}

async function excluirTransferenciaCaixinha(transferenciaId) {
    const entrada = salsiData.caixinha.find(item => String(item.transferenciaId) === String(transferenciaId) && item.tipo === 'transferencia-entrada');
    if (entrada) {
        const saldoDestino = calcularSaldoCaixinha(entrada.caixinhaId);
        if (saldoDestino + 0.005 < Number(entrada.valor || 0)) {
            alert(`Para desfazer, a caixinha de destino precisa ter ao menos ${moedaVisual(entrada.valor)} disponíveis.`);
            return;
        }
    }
    if (!confirm('Desfazer esta transferência entre caixinhas?')) return;
    salsiData.caixinha = salsiData.caixinha.filter(item => String(item.transferenciaId) !== String(transferenciaId));
    await persistirCaixinhas();
    if (typeof renderizar === 'function') renderizar();
    if (typeof renderizarVisualizacoes === 'function') renderizarVisualizacoes();
}

function renderizarDesejosDetalhadosCaixinha() {
    const container = document.getElementById('visual-caixinha-desejos');
    if (!container) return;
    const desejos = salsiData.desejos || [];
    const secundarias = garantirEstruturaCaixinhas().filter(item => !item.geral && !item.arquivada);

    if (!desejos.length) {
        container.innerHTML = `
            <div class="caixinha-detail-empty">
                <span>Nenhum desejo cadastrado.</span>
                <button type="button" onclick="abrirModalDesejo()">Adicionar desejo</button>
            </div>
        `;
        return;
    }

    container.innerHTML = desejos.map((desejo, index) => {
        const vinculada = secundarias.find(item => String(item.desejoId) === String(desejo.id));
        const saldo = vinculada ? calcularSaldoCaixinha(vinculada.id) : 0;
        const percentual = vinculada && Number(desejo.valor || 0) > 0
            ? Math.min(100, Math.round((saldo / Number(desejo.valor)) * 100))
            : 0;
        return `
            <article class="caixinha-detail-item">
                <span class="caixinha-detail-item-icon"><i class="fi fi-rr-star"></i></span>
                <div class="caixinha-detail-item-copy">
                    <small>${vinculada ? `Caixinha vinculada · ${percentual}% concluído` : 'Desejo ainda sem caixinha'}</small>
                    <strong>${escaparHtmlCarteira(desejo.nome)}</strong>
                    <span>Valor desejado: ${moedaVisual(desejo.valor)}</span>
                </div>
                <div class="caixinha-detail-item-actions">
                    ${vinculada
                        ? `<button type="button" onclick="abrirCaixinhaNaVisualizacao('${vinculada.id}')">Ver ${escaparHtmlCarteira(vinculada.nome)}</button>`
                        : `<button type="button" onclick="criarCaixinhaParaDesejo('${desejo.id}')">Criar caixinha</button>`}
                    <button type="button" class="danger" onclick="excluirDesejo(${index})">Excluir</button>
                </div>
            </article>
        `;
    }).join('');
}

function renderizarMetasAntigasDetalhadasCaixinha() {
    const section = document.getElementById('visual-caixinha-metas-section');
    const container = document.getElementById('visual-caixinha-metas-antigas');
    if (!section || !container) return;
    const metas = salsiData.metas || [];
    section.style.display = metas.length ? '' : 'none';
    if (!metas.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = metas.map(meta => `
        <article class="caixinha-detail-item">
            <span class="caixinha-detail-item-icon is-legacy"><i class="fi fi-rr-flag"></i></span>
            <div class="caixinha-detail-item-copy">
                <small>Meta antiga</small>
                <strong>${escaparHtmlCarteira(meta.nome)}</strong>
                <span>Objetivo: ${moedaVisual(meta.total || 0)} · valor informado: ${moedaVisual(meta.atual || 0)}</span>
            </div>
            <div class="caixinha-detail-item-actions">
                <button type="button" onclick="transformarMetaEmCaixinha('${meta.id}')">Transformar em caixinha</button>
            </div>
        </article>
    `).join('');
}

function renderizarCaixinhasPlanejamentoCompletoAntigo() {
    const container = document.getElementById('conteudo-meta');
    if (!container) return;
    const secundarias = garantirEstruturaCaixinhas().filter(item => !item.geral && !item.arquivada);
    const saldoSecundarias = secundarias.reduce((total, item) => total + calcularSaldoCaixinha(item.id), 0);
    const desejos = salsiData.desejos || [];

    container.innerHTML = `
        <div class="plans-summary">
            <div><span>Caixinhas secundárias</span><strong>${secundarias.length}</strong></div>
            <div><span>Guardado nelas</span><strong>${moedaVisual(saldoSecundarias)}</strong></div>
            <div><span>Planos com meta</span><strong>${secundarias.filter(item => Number(item.meta || 0) > 0).length}</strong></div>
        </div>
        ${secundarias.length ? `
            <div class="plans-caixinhas-grid">
                ${secundarias.map(caixinha => {
                    const saldo = calcularSaldoCaixinha(caixinha.id);
                    const meta = Number(caixinha.meta || 0);
                    const percentual = meta > 0 ? Math.min(100, Math.round((saldo / meta) * 100)) : 0;
                    return `
                        <article class="plan-caixinha-card">
                            <div class="plan-caixinha-head">
                                <span><i class="fi fi-rr-box-open"></i></span>
                                <div><small>${meta > 0 ? 'Plano com meta' : 'Reserva livre'}</small><strong>${escaparHtmlCarteira(caixinha.nome)}</strong></div>
                            </div>
                            <strong class="plan-caixinha-value">${moedaVisual(saldo)}</strong>
                            ${meta > 0 ? `
                                <div class="plan-caixinha-progress"><span style="width:${percentual}%"></span></div>
                                <small>${percentual}% de ${moedaVisual(meta)}</small>
                            ` : `<small>Sem meta definida</small>`}
                            <div class="plan-caixinha-actions">
                                <button onclick="abrirModalCaixinha('entrada', '${caixinha.id}')">Adicionar</button>
                                <button onclick="abrirCaixinhaNaVisualizacao('${caixinha.id}')">Detalhes</button>
                                <button onclick="abrirModalConfigCaixinha('${caixinha.id}')">Editar</button>
                                <button class="danger" onclick="excluirCaixinhaSecundaria('${caixinha.id}')">Excluir</button>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        ` : `
            <div class="plans-empty">
                <i class="fi fi-rr-box-open"></i>
                <strong>Separe seu dinheiro do seu jeito</strong>
                <p>Crie caixinhas com meta ou apenas para organizar valores sem um objetivo definido.</p>
                <button onclick="abrirModalConfigCaixinha()">Criar primeira caixinha</button>
            </div>
        `}
        <div class="plans-wishes">
            <div class="plans-section-head">
                <div><span>Lista de Desejos</span><strong>Transforme um desejo em plano</strong></div>
                <button onclick="abrirModalDesejo()">Novo desejo</button>
            </div>
            ${desejos.length ? `
                <div class="plans-wishes-list">
                    ${desejos.slice(0, 4).map(desejo => {
                        const vinculada = secundarias.find(item => String(item.desejoId) === String(desejo.id));
                        return `
                            <div>
                                <span><strong>${escaparHtmlCarteira(desejo.nome)}</strong><small>${moedaVisual(desejo.valor)}</small></span>
                                ${vinculada
                                    ? `<button onclick="abrirCaixinhaNaVisualizacao('${vinculada.id}')">${escaparHtmlCarteira(vinculada.nome)}</button>`
                                    : `<button onclick="criarCaixinhaParaDesejo('${desejo.id}')">Criar caixinha</button>`}
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : '<p class="plans-wishes-empty">Nenhum desejo cadastrado ainda.</p>'}
        </div>
        ${salsiData.metas.length ? `
            <div class="legacy-goals">
                <div class="plans-section-head"><div><span>Metas antigas</span><strong>Converta sem duplicar seu saldo</strong></div></div>
                ${salsiData.metas.map(meta => `
                    <div><span><strong>${escaparHtmlCarteira(meta.nome)}</strong><small>Meta: ${moedaVisual(meta.total || 0)} · valor informado: ${moedaVisual(meta.atual || 0)}</small></span><button onclick="transformarMetaEmCaixinha('${meta.id}')">Transformar</button></div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

function renderizarCaixinhasPlanejamento() {
    const container = document.getElementById('conteudo-meta');
    if (!container) return;
    const secundarias = garantirEstruturaCaixinhas().filter(item => !item.geral && !item.arquivada);
    const saldoSecundarias = secundarias.reduce((total, item) => total + calcularSaldoCaixinha(item.id), 0);
    const comMeta = secundarias.filter(item => Number(item.meta || 0) > 0);

    container.innerHTML = `
        <div class="plans-summary">
            <div><span>Caixinhas secundárias</span><strong>${secundarias.length}</strong></div>
            <div><span>Guardado nelas</span><strong>${moedaVisual(saldoSecundarias)}</strong></div>
            <div><span>Planos com meta</span><strong>${comMeta.length}</strong></div>
        </div>
        ${secundarias.length ? `
            <div class="plans-dashboard-preview">
                ${secundarias.slice(0, 3).map(caixinha => {
                    const saldo = calcularSaldoCaixinha(caixinha.id);
                    const meta = Number(caixinha.meta || 0);
                    const percentual = meta > 0 ? Math.min(100, Math.round((saldo / meta) * 100)) : 0;
                    return `
                        <div class="plans-dashboard-item">
                            <span class="plans-dashboard-icon"><i class="fi fi-rr-box-open"></i></span>
                            <div>
                                <small>${meta > 0 ? `${percentual}% da meta` : 'Reserva livre'}</small>
                                <strong>${escaparHtmlCarteira(caixinha.nome)}</strong>
                            </div>
                            <b>${moedaVisual(saldo)}</b>
                        </div>
                    `;
                }).join('')}
                ${secundarias.length > 3 ? `<small class="plans-dashboard-more">+ ${secundarias.length - 3} outra${secundarias.length - 3 === 1 ? '' : 's'} caixinha${secundarias.length - 3 === 1 ? '' : 's'}</small>` : ''}
            </div>
        ` : `
            <div class="plans-empty is-summary">
                <i class="fi fi-rr-box-open"></i>
                <strong>Nenhuma caixinha secundária ainda</strong>
                <p>Crie uma caixinha com meta ou apenas para separar um valor.</p>
            </div>
        `}
        <div class="plans-dashboard-footer">
            <span>Desejos, metas antigas, movimentações e configurações ficam na visão completa.</span>
            <button type="button" onclick="abrirCaixinhaNaVisualizacao('geral')">Ver detalhes da caixinha</button>
        </div>
    `;
}

function atualizarGraficoMeta() {
    renderizarCaixinhasPlanejamento();
}

function abrirCaixinhaNaVisualizacao(id) {
    if (typeof abrirDetalhesCompromissosDashboard === 'function') abrirDetalhesCompromissosDashboard('caixinha');
    setTimeout(() => document.getElementById(`caixinha-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 160);
}

async function criarCaixinhaParaDesejo(desejoId) {
    const desejo = (salsiData.desejos || []).find(item => String(item.id) === String(desejoId));
    if (!desejo) return;
    const existente = garantirEstruturaCaixinhas().find(item => String(item.desejoId) === String(desejo.id));
    if (existente) {
        abrirCaixinhaNaVisualizacao(existente.id);
        return;
    }
    salsiData.caixinhas.push({
        id: gerarIdCaixinha(),
        nome: desejo.nome,
        descricao: 'Caixinha criada a partir da Lista de Desejos.',
        meta: Number(desejo.valor || 0) || null,
        desejoId: desejo.id,
        geral: false,
        criadaEm: new Date().toISOString()
    });
    await persistirCaixinhas();
    if (typeof renderizar === 'function') renderizar();
    if (typeof renderizarVisualizacoes === 'function') renderizarVisualizacoes();
    if (typeof mostrarToast === 'function') mostrarToast('Caixinha criada para este desejo.');
}

async function transformarMetaEmCaixinha(metaId) {
    const meta = (salsiData.metas || []).find(item => String(item.id) === String(metaId));
    if (!meta) return;
    if (!confirm('A caixinha será criada com a meta, mas sem adicionar saldo automaticamente. Assim nenhum dinheiro será duplicado. Continuar?')) return;
    garantirEstruturaCaixinhas().push({
        id: gerarIdCaixinha(),
        nome: meta.nome,
        descricao: Number(meta.atual || 0) > 0 ? `Valor informado na meta antiga: ${moedaVisual(meta.atual)}. Transfira ou adicione esse valor se ele estiver realmente guardado.` : 'Convertida de uma meta antiga.',
        meta: Number(meta.total || 0) || null,
        desejoId: null,
        geral: false,
        criadaEm: new Date().toISOString()
    });
    salsiData.metas = salsiData.metas.filter(item => String(item.id) !== String(metaId));
    await persistirCaixinhas();
    if (typeof renderizar === 'function') renderizar();
    if (typeof renderizarVisualizacoes === 'function') renderizarVisualizacoes();
    if (typeof mostrarToast === 'function') mostrarToast('Meta transformada em caixinha.');
}

function renderizarDesejosIntegradosAntigo() {
    garantirEstruturaCaixinhas();
    const container = document.getElementById('lista-desejos-conteudo');
    if (!container) return;
    if (!salsiData.desejos.length) {
        container.innerHTML = '<p style="font-size:13px;color:var(--text-sec);text-align:center;padding:15px 0;margin:0;">Nenhum desejo cadastrado. Sonhe alto!</p>';
        return;
    }
    container.innerHTML = salsiData.desejos.map((desejo, index) => {
        const caixinha = salsiData.caixinhas.find(item => String(item.desejoId) === String(desejo.id));
        return `
            <div class="wish-plan-row">
                <div><strong>${escaparHtmlCarteira(desejo.nome)}</strong><span>${moedaVisual(desejo.valor)}</span>${caixinha ? `<small>Caixinha: ${escaparHtmlCarteira(caixinha.nome)}</small>` : ''}</div>
                <div>
                    ${caixinha ? `<button onclick="abrirCaixinhaNaVisualizacao('${caixinha.id}')">Ver caixinha</button>` : `<button onclick="criarCaixinhaParaDesejo('${desejo.id}')">Criar caixinha</button>`}
                    <button class="danger" onclick="excluirDesejo(${index})">×</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderizarDesejos() {
    garantirEstruturaCaixinhas();
    const container = document.getElementById('lista-desejos-conteudo');
    if (!container) return;
    if (!salsiData.desejos.length) {
        container.innerHTML = '<p style="font-size:13px;color:var(--text-sec);text-align:center;padding:15px 0;margin:0;">Nenhum desejo cadastrado. Sonhe alto!</p>';
        return;
    }

    container.innerHTML = salsiData.desejos.map((desejo, index) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px dashed var(--border);">
            <div style="display:flex;flex-direction:column;gap:4px;min-width:0;">
                <span style="font-weight:700;font-size:14px;color:var(--text-main);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escaparHtmlCarteira(desejo.nome)}</span>
                <span style="font-size:12px;color:var(--text-sec);font-weight:600;">${moedaVisual(desejo.valor)}</span>
            </div>
            <button onclick="excluirDesejo(${index})" style="background:#fef2f2;color:#ef4444;border:1px solid #fee2e2;width:30px;height:30px;border-radius:8px;cursor:pointer;font-weight:bold;display:flex;align-items:center;justify-content:center;transition:.2s;" onmouseover="this.style.opacity=.7" onmouseout="this.style.opacity=1">×</button>
        </div>
    `).join('');
}

async function salvarDesejo() {
    const nome = document.getElementById('d-nome').value.trim();
    const valor = parseValorMonetarioInput(document.getElementById('d-valor').value);
    if (!nome || valor <= 0) {
        alert('Preencha o nome e um valor aproximado válido!');
        return;
    }
    garantirEstruturaCaixinhas();
    salsiData.desejos.push({ id: gerarIdCaixinha('desejo'), nome, valor });
    document.getElementById('modal-desejo').close();
    await persistirCaixinhas();
    renderizarDesejos();
    renderizarCaixinhasPlanejamento();
    renderizarDesejosDetalhadosCaixinha();
    if (typeof mostrarToast === 'function') mostrarToast('Desejo adicionado!');
}

async function excluirDesejo(index) {
    const desejo = salsiData.desejos?.[index];
    if (!desejo || !confirm('Já comprou ou desistiu desse desejo? Posso excluir?')) return;
    garantirEstruturaCaixinhas().forEach(caixinha => {
        if (String(caixinha.desejoId) === String(desejo.id)) caixinha.desejoId = null;
    });
    salsiData.desejos.splice(index, 1);
    await persistirCaixinhas();
    renderizarDesejos();
    renderizarCaixinhasPlanejamento();
    renderizarDesejosDetalhadosCaixinha();
}

function obterResumoCaixinhaDashboard(mesBase) {
    garantirEstruturaCaixinhas();
    const saldo = calcularSaldoCaixinha();
    const movimentosExternos = salsiData.caixinha.filter(item => item.tipo === 'entrada' || item.tipo === 'saida');
    const movimentoMes = movimentosExternos.reduce((total, movimento) => {
        const data = typeof dataLocalDivida === 'function' ? dataLocalDivida(movimento.data) : new Date(`${movimento.data}T12:00:00`);
        if (!data || data.getMonth() !== mesBase.getMonth() || data.getFullYear() !== mesBase.getFullYear()) return total;
        return total + (movimento.tipo === 'saida' ? -Number(movimento.valor || 0) : Number(movimento.valor || 0));
    }, 0);
    return { saldo, movimentoMes, quantidade: salsiData.caixinhas.filter(item => !item.arquivada).length };
}

document.addEventListener('DOMContentLoaded', () => {
    garantirEstruturaCaixinhas();
});
