let salsiData = JSON.parse(localStorage.getItem('salsifin_cache')) || { config: { categorias: [], bancos: [] }, entradas: [], transacoes: [], metas: [] };
let subAbaCartaoAtiva = 'credito';
let dataFiltro = new Date();
dataFiltro.setDate(1);  

// 👇 CÓDIGO NOVO DA TRAVA DE SCROLL FICA AQUI 👇
// ==========================================
// TRAVA GLOBAL DE SCROLL PARA POP-UPS
// ==========================================
const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

HTMLDialogElement.prototype.showModal = function() {
    document.body.style.overflow = 'hidden'; // Trava o fundo
    originalShowModal.apply(this, arguments);
};

HTMLDialogElement.prototype.close = function() {
    document.body.style.overflow = ''; // Destrava o fundo
    originalClose.apply(this, arguments);
};
// ==========================================

// Forçar estado inicial ao carregar a página APENAS NO MOBILE
// --- CONTROLE DE TELA (PC vs MOBILE) ---
function ajustarTelas() {
    if (window.innerWidth <= 1024) {
        // NO CELULAR: Apenas garante que o Resumo seja a aba principal ao abrir
        const cardRes = document.getElementById('card-resumo-conteudo');
        const cardTer = document.getElementById('card-terceiros');
        
        if (cardRes) cardRes.style.setProperty('display', 'block', 'important');
        if (cardTer) cardTer.style.setProperty('display', 'none', 'important');
    } else {
        // NO PC: Arranca o "none !important" das abas mães e dos cards!
        const elementosParaMostrar = [
            'aba-resumo',           // A aba mãe do resumo
            'aba-planejamento',     // A aba mãe dos gráficos/metas (O SEU ACHADO!)
            'card-resumo-conteudo', 
            'card-terceiros', 
            'card-grafico',         
            'card-metas-acordeon',
            'card-desejos-acordeon'   
        ];
        
        elementosParaMostrar.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                // 1. Remove qualquer display inline que o clique do celular tenha colocado
                elemento.style.removeProperty('display');
                
                // 2. Garantia dupla: se ainda estiver escondido, forçamos a aparecer!
                if (window.getComputedStyle(elemento).display === 'none') {
                    elemento.style.setProperty('display', 'block', 'important');
                }
            }
        });
		
    }
}

// Executa a função quando a página carrega e quando a janela é redimensionada
window.addEventListener('DOMContentLoaded', ajustarTelas);
window.addEventListener('resize', ajustarTelas);

function iniciar() { 
    // 💉 VACINA ANTI-FANTASMA: Corrige os dados que ficaram invisíveis
    let precisaSalvar = false;
    if (salsiData && salsiData.transacoes) {
        salsiData.transacoes.forEach(t => {
            if (t.tipo === 'pix') {
                t.tipo = 'debito'; // Volta para o tipo correto do sistema
                t.formaPagamento = 'PIX'; // Mantém a etiqueta de PIX
                precisaSalvar = true;
            }
        });
        if (precisaSalvar) {
            localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
            if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
        }
    }
    // --------------------------------------------------------------

    carregarTemaPreferido(); 
    popularSelects(); 
    renderizar();
	
	// 👇 NOVA VERIFICAÇÃO INTELIGENTE POR CONTA 👇
    // Só abre o tutorial se este usuário logado específico nunca tiver visto
    if (window.auth && window.auth.currentUser && salsiData && salsiData.config && !salsiData.config.tutorialVisto) {
        setTimeout(abrirOnboarding, 1000);
    }
}

function popularSelects() {
    const cat = document.getElementById('g-categoria');
    if(cat) cat.innerHTML = salsiData.config.categorias.map(c => `<option value="${c}">${c}</option>`).join('');
    
    // Chama o nosso novo filtro inteligente de bancos
    atualizarListaBancos();
}

// NOVA FUNÇÃO: Filtro inteligente
function atualizarListaBancos() {
    const selectBanco = document.getElementById('g-banco');
    if (!selectBanco) return;

    // Descobre se o usuário tá lançando um gasto de Crédito (cartao) ou Débito (debito)
    const tipoPagamentoEl = document.getElementById('g-tipo');
    
    // O VALOR CORRETO É 'cartao', 'debito' ou 'fixo' baseado no seu HTML
    const tipoPagamento = tipoPagamentoEl ? tipoPagamentoEl.value : 'cartao'; 
    
    selectBanco.innerHTML = '';
    if (!salsiData.config.bancos) return;

    salsiData.config.bancos.forEach(nomeBanco => {
        // Busca os detalhes desse banco
        const detalhe = salsiData.config.detalhesBancos?.find(d => d.nome === nomeBanco);
        const isDebitoOnly = detalhe ? detalhe.isDebitoOnly : nomeBanco.includes('(débito)');
        
        // A REGRA DE OURO: Se o gasto for "cartao" (Crédito) E o cartão for "apenas débito", pula ele!
        if (tipoPagamento === 'cartao' && isDebitoOnly) return; 
        
        const opt = document.createElement('option');
        opt.value = nomeBanco;
        opt.textContent = nomeBanco;
        selectBanco.appendChild(opt);
    });
}

function atualizarHumorSalsicha(saldo) {
    const mascote = document.getElementById('mascote-status');
    const frase = document.getElementById('mascote-frase');
    if(!mascote || !frase) return;
    
    mascote.classList.remove('mascot-jump');
    void mascote.offsetWidth; 
    mascote.classList.add('mascot-jump');

    if (saldo > 500) {
        mascote.innerText = "🐕‍🦺"; 
        frase.innerText = "O passeio tá garantido! Sobrou osso!";
    } else if (saldo >= 0) {
        mascote.innerText = "🐕"; 
        frase.innerText = "Tudo sob controle por aqui, humano.";
    } else {
        mascote.innerText = "🌭"; 
        frase.innerText = "Tô virando hotdog! Fecha essa torneira!";
    }
}

function criarDataCompetencia(dataBase, mesesParaSomar = 0) {
    return new Date(
        dataBase.getFullYear(),
        dataBase.getMonth() + mesesParaSomar,
        1
    );
}

function calcularCompetenciaInicialGasto(t) {
    const dataCompra = new Date(t.dataCompra + "T12:00:00");
    const delayManual = parseInt(t.delayPagamento) || 0;

    /*
        Se o usuário forçou mês seguinte ou daqui a 2 meses,
        essa escolha manda mais que o fechamento do cartão.
    */
    if (delayManual > 0) {
        return criarDataCompetencia(dataCompra, delayManual);
    }

    /*
        Débito, Pix, dinheiro e fixos seguem o mês da data da compra,
        salvo se tiver delay manual.
    */
    if (t.tipo !== 'cartao') {
        return criarDataCompetencia(dataCompra, 0);
    }

    const detalhesBanco = salsiData.config.detalhesBancos?.find(b => b.nome === t.banco);

    if (!detalhesBanco || detalhesBanco.isDebitoOnly || !detalhesBanco.fechamento) {
        return criarDataCompetencia(dataCompra, 0);
    }

    const fechamento = parseInt(detalhesBanco.fechamento);
    const diaCompra = dataCompra.getDate();

    /*
        Compra depois do fechamento entra na fatura do mês seguinte.
        Ex: compra 31/05, fechamento dia 5 => fatura de junho.
    */
    const mesesParaSomar = diaCompra > fechamento ? 1 : 0;

    return criarDataCompetencia(dataCompra, mesesParaSomar);
}

function gastoEstaNovo(t) {
    return t && t.destaqueAte && Date.now() < t.destaqueAte;
}

function limparDestaquesExpirados() {
    if (!salsiData || !Array.isArray(salsiData.transacoes)) return;

    let alterou = false;
    const agora = Date.now();

    salsiData.transacoes.forEach(t => {
        if (t.destaqueAte && agora >= t.destaqueAte) {
            delete t.destaqueAte;
            alterou = true;
        }
    });

    if (alterou) {
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
    }
}

function renderizar() {
    limparDestaquesExpirados();

	if (typeof garantirOrdemCronologica === 'function') garantirOrdemCronologica();
	
    const m = dataFiltro.getMonth();
    const a = dataFiltro.getFullYear();
    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    if (typeof garantirOrdemCronologica === 'function') garantirOrdemCronologica();

    document.getElementById('display-mes-ano').innerText = `${mesesNomes[m]} ${a}`;
    document.getElementById('ano-badge-dinamico').innerText = a;

// --- ATUALIZA OS NOMES DOS MESES NO MOBILE ---
    const mobPrev = document.getElementById('mob-prev-month');
    const mobCurr = document.getElementById('mob-curr-month');
    const mobNext = document.getElementById('mob-next-month');

    if (mobCurr) {
        let prevM = m - 1;
        if (prevM < 0) prevM = 11;
        
        let nextM = m + 1;
        if (nextM > 11) nextM = 0;

        mobPrev.innerText = mesesNomes[prevM].substring(0, 3);
        mobCurr.innerText = `${mesesNomes[m]} ${a}`; 
        mobNext.innerText = mesesNomes[nextM].substring(0, 3);
    }

	// --- ATUALIZA A TIMELINE DE 5 MESES E DATA NO PC ---
    if (window.innerWidth > 1024) {
        let m2 = m - 2; let a2 = a; if (m2 < 0) { m2 += 12; a2--; }
        let m1 = m - 1; let a1 = a; if (m1 < 0) { m1 += 12; a1--; }
        let p1 = m + 1; let ap1 = a; if (p1 > 11) { p1 -= 12; ap1++; }
        let p2 = m + 2; let ap2 = a; if (p2 > 11) { p2 -= 12; ap2++; }

        const getNome = (mesIdx) => mesesNomes[mesIdx].substring(0, 3);
        
        const elM2 = document.getElementById('tl-m2'); if(elM2) elM2.innerText = getNome(m2);
        const elM1 = document.getElementById('tl-m1'); if(elM1) elM1.innerText = getNome(m1);
        const elP1 = document.getElementById('tl-p1'); if(elP1) elP1.innerText = getNome(p1);
        const elP2 = document.getElementById('tl-p2'); if(elP2) elP2.innerText = getNome(p2);

        // Atualiza a pílula de data diária (Ex: Sáb, 26 Ago)
        const dataHojeStr = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
        const dataFormatada = dataHojeStr.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        
        const headerData = document.getElementById('header-current-date');
        if (headerData) headerData.innerText = dataFormatada;
    }
    // -----------------------------------------------------------
    // ---------------------------------------------

    // 1. Entradas (Sidebar + Aba Mobile)
    const entMes = salsiData.entradas.filter(e => e.mes === m && e.ano === a);
    const totalEnt = entMes.reduce((acc, curr) => acc + curr.valor, 0);

    // RENDER PC (Sidebar - Apenas o X estiloso)
    const listaEntradasSidebar = document.getElementById('lista-entradas');
const extraEntradasSidebar = document.getElementById('sidebar-entradas-extra');
const btnVerMaisEntradas = document.getElementById('btn-ver-mais-entradas');
const cardEntradasSidebar = document.getElementById('sidebar-entradas-card');

if (listaEntradasSidebar) {
    const entradasOrdenadas = [...entMes].sort((a, b) => {
        const dataA = a.dataRecebimento ? new Date(a.dataRecebimento + "T12:00:00") : new Date(a.ano, a.mes, 1);
        const dataB = b.dataRecebimento ? new Date(b.dataRecebimento + "T12:00:00") : new Date(b.ano, b.mes, 1);

        return dataB - dataA;
    });

    const entradasOcultas = Math.max(0, entradasOrdenadas.length - 3);

listaEntradasSidebar.innerHTML = entradasOrdenadas.map((e, itemIndex) => {
    const idx = salsiData.entradas.indexOf(e);
    const classeExtra = itemIndex >= 3 ? ' sidebar-entrada-extra-item' : '';

    return `
        <div class="sidebar-entrada-item${classeExtra}">
            <span class="sidebar-entrada-nome" onclick="verDetalhesEntrada(${idx})" title="Ver detalhes">
                ${e.nome}
            </span>

            <div class="sidebar-entrada-valor">
                <strong>R$ ${e.valor.toFixed(2)}</strong>
                <button class="btn-del sidebar-entrada-del" onclick="excluirEntrada(${idx})" title="Apagar">×</button>
            </div>
        </div>
    `;
}).join('') || `
    <div class="sidebar-entradas-vazio">
        Nenhuma entrada neste mês.
    </div>
`;

    if (extraEntradasSidebar) {
        extraEntradasSidebar.textContent =
            !sidebarEntradasExpandida && entradasOcultas > 0
                ? `+ ${entradasOcultas} entrada${entradasOcultas === 1 ? '' : 's'}`
                : '';
    }

    if (btnVerMaisEntradas) {
        btnVerMaisEntradas.style.display = entradasOrdenadas.length > 3 ? 'block' : 'none';
        btnVerMaisEntradas.textContent = sidebarEntradasExpandida ? 'Ver menos' : 'Ver mais';
    }

    if (cardEntradasSidebar) {
        cardEntradasSidebar.classList.toggle('is-expanded', sidebarEntradasExpandida);
    }
}

    // RENDER MOBILE (Aba dedicada - Fica um card limpo e totalmente clicável)
    const listaMob = document.getElementById('lista-entradas-mobile');
    if (listaMob) {
        listaMob.innerHTML = entMes.map(e => {
            const idx = salsiData.entradas.indexOf(e);
            return `<div class="entrada-item-mobile entrada-card-hover" onclick="verDetalhesEntrada(${idx})">
                <div class="ent-info">
                    <strong>${e.nome}</strong>
                    <span style="font-size: 11px; color: var(--text-sec);">${e.categoria || 'Recebido'}</span>
                </div>
                <div class="ent-valor-box">
                    <span class="ent-valor" style="font-weight: 600;">+ R$ ${e.valor.toFixed(2)}</span>
                </div>
            </div>`;
        }).join('') || '<p style="text-align:center; padding:20px; color:var(--text-sec)">Nenhuma entrada.</p>';
    }

// Atualiza os totais (PC e Mobile)
    const sideTotal = document.getElementById('sidebar-total-valor');
    if (sideTotal) sideTotal.innerText = `R$ ${totalEnt.toFixed(2)}`;
    
    // A MÁGICA DA ENTRADA NO MOBILE:
    const totalEntMob = document.getElementById('total-entradas-mobile-val');
    if (totalEntMob) totalEntMob.innerText = `R$ ${totalEnt.toFixed(2)}`;

    // 2. Limpeza de Tabelas (PC e Mobile)
    const fTable = document.querySelector('#tabela-fixos tbody'), 
          cTable = document.querySelector('#tabela-cartao tbody'), 
          dTable = document.querySelector('#tabela-debito tbody'),
          tTable = document.querySelector('#lista-terceiros'),
          cMobile = document.getElementById('lista-cartao-mobile'),
          dMobile = document.getElementById('lista-debito-mobile'),
          fMobile = document.getElementById('lista-fixos-mobile'),
          mTerceiros = document.getElementById('lista-terceiros-mobile');

    if(fTable) fTable.innerHTML = ''; 
    if(cTable) cTable.innerHTML = ''; 
    if(dTable) dTable.innerHTML = '';
    if(tTable) tTable.innerHTML = '';
    if(cMobile) cMobile.innerHTML = ''; 
    if(dMobile) dMobile.innerHTML = '';
    if(fMobile) fMobile.innerHTML = ''; 
    if(mTerceiros) mTerceiros.innerHTML = '';

    // 3. Acumuladores do Mês (AGORA COM O TERCEIROS)
    let totalGastoMes = 0, totalCartMes = 0, totalFixoMes = 0, totalDebitoMes = 0, totalTerceirosMes = 0;
    let tagSum = {}, bankSum = {};
    let temGastoTerceiro = false;

    salsiData.transacoes.forEach(t => {
        const d = new Date(t.dataCompra + "T00:00:00");

const competenciaInicial = calcularCompetenciaInicialGasto(t);
const mesRef = competenciaInicial.getMonth();
const anoRef = competenciaInicial.getFullYear();

const diff = (a - anoRef) * 12 + (m - mesRef);

        if (diff >= 0 && diff < t.parcelas) {
            const val = t.tipo === 'cartao' ? t.valorParcela : t.valorTotal;
            const idx = salsiData.transacoes.indexOf(t);
            
            const isNovo = gastoEstaNovo(t);
            const classeNovo = isNovo ? ' gasto-recem-adicionado' : '';
            const tagNovo = isNovo ? '<span class="tag-novo-lancamento">NOVO</span>' : '';

			// Formata a data (Ex: 05/12) para usar nos cartões mobile
            const dFmt = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
			const dataSutil = `<span style="font-size: 11px; color: #a0aec0; font-weight: 500;">${dFmt}</span>`;

            // --- NOVA LÓGICA DE FILTRAGEM PREMIUM (MOTOR V8) ---
            const pegarFiltro = (id) => document.getElementById(id) ? document.getElementById(id).getAttribute('data-value') : 'Todos';

            const fCredBanco = pegarFiltro('filtro-cred-banco');
            const fCredCat = pegarFiltro('filtro-cred-cat');
            
            const fDebForma = pegarFiltro('filtro-deb-forma');
            const fDebCat = pegarFiltro('filtro-deb-cat');
            
            const fTercNome = pegarFiltro('filtro-terc-nome');
            const fTercBanco = pegarFiltro('filtro-terc-banco');
            
            const fFix = pegarFiltro('filtro-fixos');
            
            // 1. Aplica filtros nas Suas Contas (Ignora Terceiros)
            if (!t.eDeTerceiro) {
                if (t.tipo === 'debito') {
                    const forma = t.formaPagamento || 'Débito';
                    if (fDebForma !== 'Todos' && forma !== fDebForma) return; 
                    if (fDebCat !== 'Todos' && t.categoria !== fDebCat) return;
                } else if (t.tipo === 'cartao') {
                    if (fCredBanco !== 'Todos' && t.banco !== fCredBanco) return; 
                    if (fCredCat !== 'Todos' && t.categoria !== fCredCat) return;
                } else if (t.tipo === 'fixo') {
                    if (fFix === 'Pagos' && !t.pago) return; 
                    if (fFix === 'Pendentes' && t.pago) return; 
                }
            }
            // ----------------------------------------

            // --- GASTOS DE TERCEIROS ---
            if (t.eDeTerceiro) {
                // 2. A barreira de Filtro de Terceiros!
                if (fTercNome !== 'Todos' && t.nomeTerceiro !== fTercNome) return;
                if (fTercBanco !== 'Todos' && t.banco !== fTercBanco) return;

                totalTerceirosMes += val; 
                temGastoTerceiro = true;

                const tagTipoPC = t.tipo === 'cartao' 
                    ? `<span class="badge" style="background:${getCor(t.banco)}">${t.banco}</span>`
                    : `<span class="badge-tag">DÉBITO</span>`;

                // 👇 NOVA LÓGICA DE PARCELA INDIVIDUAL 👇
                const parcelaIndex = diff; // Sabe exatamente qual mês estamos olhando
                let estaParcelaPaga = false;
                
                if (t.pagamentosParcelas && t.pagamentosParcelas[parcelaIndex] !== undefined) {
                    estaParcelaPaga = t.pagamentosParcelas[parcelaIndex];
                } else {
                    estaParcelaPaga = !!t.pago; // Fallback para gastos antigos
                }

                const statusChecked = estaParcelaPaga ? 'checked' : '';

                if(tTable) {
                    // Visual da linha e Checkbox
                    const estiloPCTerceiro = estaParcelaPaga ? '' : 'style="opacity: 0.5; font-style: italic;"';
                    tTable.innerHTML += `
                        <tr class="desktop-only-row" ${estiloPCTerceiro}>
                            <td>${dataSutil}</td>
                            <td style="cursor: pointer; font-weight: 500;" onclick="verDetalhes(${idx})">${t.nome} ${tagNovo}</td>
                            <td><span class="badge-tag">${t.nomeTerceiro}</span></td>
                            <td style="text-align: center;">${tagTipoPC}</td>
                            <td style="text-align: center;">${diff + 1}/${t.parcelas}</td>
                            <td style="text-align: right; font-weight: 600;">R$ ${val.toFixed(2)}</td>
                            <td style="text-align: center;"><input type="checkbox" ${statusChecked} onchange="alternarStatusPago(${idx}, ${parcelaIndex})"></td>
                            <td><button class="btn-del" onclick="excluirGasto(${idx})">×</button></td>
                        </tr>`;
                }

                if (mTerceiros) {
                    // Lógica de opacidade e Tags
                    const opacidadeMob = estaParcelaPaga ? '1' : '0.6'; 
                    const tagStatus = estaParcelaPaga 
                        ? `<span class="badge" style="background: #21c25e; font-size: 9px;">PAGO</span>`
                        : `<span class="badge-tag" style="background: #f0f2f1; color: #7a8b87; font-size: 9px;">PENDENTE</span>`;

                    mTerceiros.innerHTML += `
                        <div class="cartao-item-mobile${classeNovo}" onclick="verDetalhes(${idx})" style="cursor: pointer; opacity: ${opacidadeMob}; transition: 0.2s;">
                            <div class="cartao-info-principal">
                                <div class="cartao-nome-grupo">
                                    <strong>${t.nome}</strong>
${tagNovo}
                                    <span class="cartao-parcela-tag">${diff + 1}/${t.parcelas}</span>
                                </div>
                                <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                                    <input type="checkbox" ${statusChecked} onclick="event.stopPropagation()" onchange="alternarStatusPago(${idx}, ${parcelaIndex})" style="transform: scale(1.3); cursor: pointer; accent-color: #21c25e;">
                                    ${tagStatus}
                                    <span style="font-size: 10px; color: #a0aec0; margin-left: 4px;">${t.nomeTerceiro} • ${t.banco}</span>
                                </div>
                            </div>
                            <div class="cartao-valor-grupo">
                                <span class="cartao-valor" style="color: #ef4444;">R$ ${val.toFixed(2)}</span>
                                <button class="btn-del" onclick="event.stopPropagation(); excluirGasto(${idx})">×</button>
                            </div>
                        </div>`;
                }
            }
            // --- GASTOS PESSOAIS ---
            else {
                // 1. Só contabiliza se NÃO for fixo, ou se for fixo e estiver PAGO (Checked)
                if (t.tipo !== 'fixo' || (t.tipo === 'fixo' && t.pago === true)) {
                    totalGastoMes += val;
                    tagSum[t.categoria] = (tagSum[t.categoria] || 0) + val;
                    
                    // 2. A MÁGICA DO RESUMO MENSAL: 
                    // Soma o Gasto Fixo na barra do Banco (para formar a Fatura real no painel central),
                    // MAS não adiciona no "totalCartMes", blindando a aba de Cartões contra bugs de filtro!
                    if (t.tipo === 'fixo' && t.banco) {
                        const detalheBanco = salsiData.config.detalhesBancos?.find(d => d.nome === t.banco);
                        const isDebitoOnly = detalheBanco ? detalheBanco.isDebitoOnly : t.banco.toLowerCase().includes('débito');
                        
                        if (!isDebitoOnly) {
                            bankSum[t.banco] = (bankSum[t.banco] || 0) + val; 
                        }
                    }
                }

                // Lógicas específicas de renderização das Tabelas
                if (t.tipo === 'fixo') {
                    if (t.pago === true) totalFixoMes += val;
                    
                    const estiloPC = t.pago ? '' : 'style="opacity: 0.5; font-style: italic;"';
                    if(fTable) {
                        fTable.innerHTML += `
                            <tr ${estiloPC} class="desktop-only-row">
                                <td style="cursor: pointer; font-weight: 500; width: 50%;" onclick="verDetalhes(${idx})">${t.nome} ${tagNovo}</td>
                                <td style="width: 25%;">R$ ${val.toFixed(2)}</td>
                                <td style="text-align: center; width: 15%;"><input type="checkbox" ${t.pago ? 'checked' : ''} onchange="alternarStatusPago(${idx})"></td>
                                <td style="width: 10%;"><button class="btn-del" onclick="excluirGasto(${idx})">×</button></td>
                            </tr>`;
                    }

                    if(fMobile) {
                        const opacidadeMob = t.pago ? '1' : '0.6'; 
                        const tagStatus = t.pago 
                            ? `<span class="badge" style="background: #21c25e; font-size: 9px;">PAGO</span>`
                            : `<span class="badge-tag" style="background: #f0f2f1; color: #7a8b87; font-size: 9px;">PENDENTE</span>`;

                        fMobile.innerHTML += `
                            <div class="cartao-item-mobile${classeNovo}" onclick="verDetalhes(${idx})" style="cursor: pointer; opacity: ${opacidadeMob}; transition: 0.2s;">
                                <div class="cartao-info-principal">
                                    <div class="cartao-nome-grupo">
                                        <strong>${t.nome}</strong>
${tagNovo}
                                    </div>
                                    <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                                        <input type="checkbox" ${t.pago ? 'checked' : ''} onclick="event.stopPropagation()" onchange="alternarStatusPago(${idx})" style="transform: scale(1.3); cursor: pointer; accent-color: #21c25e;">
                                        ${tagStatus}
                                    </div>
                                </div>
                                <div class="cartao-valor-grupo">
                                    <span class="cartao-valor">R$ ${val.toFixed(2)}</span>
                                    <button class="btn-del" onclick="event.stopPropagation(); excluirGasto(${idx})">×</button>
                                </div>
                            </div>`;
                    }
                } else if (t.tipo === 'debito') {
                    totalDebitoMes += val;
                    
                    const formaPagTag = t.formaPagamento || 'Débito'; 
                    let corTag = '#4299e1'; 
                    if (formaPagTag === 'PIX') corTag = '#32bcad'; 
                    if (formaPagTag === 'Dinheiro') corTag = '#48bb78'; 
                    
                    if(dTable) {
                        dTable.innerHTML += `
                            <tr class="desktop-only-row${classeNovo}">
                                <td>${dataSutil}</td>
                                <td style="cursor:pointer; line-height: 1.4;" onclick="verDetalhes(${idx})">
                                    <div style="font-weight: 600; color: var(--text-main);">${t.nome} ${tagNovo}</div>
                                    <div style="font-size: 11px; color: #7a8b87; margin-top: 2px;">${t.categoria}</div>
                                </td>
                                <td style="text-align: center; vertical-align: middle;">
                                    <span class="badge" style="background:${corTag}; font-size: 10px; padding: 4px 8px; letter-spacing: 0.5px;">${formaPagTag}</span>
                                </td>
                                <td style="font-weight: 700; text-align: right; vertical-align: middle;">R$ ${val.toFixed(2)}</td>
                                <td style="text-align: center; vertical-align: middle;"><button class="btn-del" onclick="excluirGasto(${idx})">×</button></td>
                            </tr>`;
                    }

                    if (dMobile) {
                        dMobile.innerHTML += `
                            <div class="cartao-item-mobile${classeNovo}" onclick="verDetalhes(${idx})" style="cursor: pointer;">
                                <div class="cartao-info-principal">
                                    <div class="cartao-nome-grupo">
                                        <strong>${t.nome}</strong>
${tagNovo}
                                    </div>
                                    <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
                                        <span class="badge-tag" style="background: #f0f2f1; color: #7a8b87; font-size: 10px;">${t.categoria}</span>
                                        <span class="badge" style="background:${corTag}; font-size: 9px; padding: 3px 6px;">${formaPagTag}</span>
                                    </div>
                                </div>
                                <div class="cartao-valor-grupo">
                                    <span class="cartao-valor" style="color: #ef4444;">R$ ${val.toFixed(2)}</span>
                                    <button class="btn-del" onclick="event.stopPropagation(); excluirGasto(${idx})">×</button>
                                </div>
                            </div>`;
                    }
                } else if (t.tipo === 'cartao') {
                    totalCartMes += val;
                    bankSum[t.banco] = (bankSum[t.banco] || 0) + val;

                    if(cTable) {
                        cTable.innerHTML += `
                            <tr class="desktop-only-row${classeNovo}">
                                <td>${dataSutil}</td>
                                <td style="font-weight: 500; cursor: pointer;" onclick="verDetalhes(${idx})">${t.nome} ${tagNovo}</td>
                                <td style="color: var(--text-sec); font-size: 11px; text-align: center;">${diff + 1}/${t.parcelas}</td>
                                <td style="text-align: center;"><span class="badge" style="background:${getCor(t.banco)}">${t.banco}</span></td>
                                <td style="text-align: right; font-weight: 600;">R$ ${val.toFixed(2)}</td>
                                <td style="text-align: center;"><button class="btn-del" onclick="excluirGasto(${idx})">×</button></td>
                            </tr>`;
                    }

                    if (cMobile) {
                        cMobile.innerHTML += `
                            <div class="cartao-item-mobile${classeNovo}" onclick="verDetalhes(${idx})" style="cursor: pointer;">
                                <div class="cartao-info-principal">
                                    <div class="cartao-nome-grupo">
                                        <strong>${t.nome}</strong>
${tagNovo}
                                        <span class="cartao-parcela-tag">${diff + 1}/${t.parcelas}</span>
                                    </div>
                                    <span class="badge" style="background:${getCor(t.banco)}">${t.banco}</span>
                                </div>
                                <div class="cartao-valor-grupo">
                                    <span class="cartao-valor">R$ ${val.toFixed(2)}</span>
                                    <button class="btn-del" onclick="event.stopPropagation(); excluirGasto(${idx})">×</button>
                                </div>
                            </div>`;
                    }
                }
            }
        }
    });

// --- ESTADOS VAZIOS (EMPTY STATES) NAS LISTAS MOBILE ---
    const msgVazio = (txt) => `<p style="text-align:center; padding:30px 20px; color:#a0aec0; font-size:13px; font-weight:500;">${txt}</p>`;
    
    if (mTerceiros && mTerceiros.innerHTML.trim() === '') mTerceiros.innerHTML = msgVazio("Nenhum gasto de terceiro.");
    if (fMobile && fMobile.innerHTML.trim() === '') fMobile.innerHTML = msgVazio("Nenhum gasto fixo.");
    if (dMobile && dMobile.innerHTML.trim() === '') dMobile.innerHTML = msgVazio("Nenhum gasto.");
    if (cMobile && cMobile.innerHTML.trim() === '') cMobile.innerHTML = msgVazio("Nenhum gasto.");
    // -------------------------------------------------------

    // --- A MÁGICA: ATUALIZA OS TOTAIS NO MOBILE ---
    const tDebMob = document.getElementById('total-debito-mobile-val');
    if (tDebMob) tDebMob.innerText = `R$ ${totalDebitoMes.toFixed(2)}`;

    const tCredMob = document.getElementById('total-credito-mobile-val');
    if (tCredMob) tCredMob.innerText = `R$ ${totalCartMes.toFixed(2)}`;

    const tFixMob = document.getElementById('total-fixos-mobile-val');
    if (tFixMob) tFixMob.innerText = `R$ ${totalFixoMes.toFixed(2)}`;

    const tTercMob = document.getElementById('total-terceiros-mobile-val');
    if (tTercMob) tTercMob.innerText = `R$ ${totalTerceirosMes.toFixed(2)}`;
    // ----------------------------------------------

// 5. Resumo Mensal Central (Bancos, Tags e Entradas COM METAS INTELIGENTES)
    
    // Função interna que constrói a linha de visualização
    function renderLinhaOrcamento(nome, valor, isEntrada) {
        const meta = getMetaOrcamento(nome, m, a);
        let corText = '';
        
        // A regra de cor: Só fica vermelho se NÃO for entrada E o gasto for maior que a meta
        if (meta > 0 && !isEntrada && valor > meta) {
            corText = 'color: #ef4444; font-weight: 800;'; // Vermelho e negrito!
        }
        
        const txtMeta = meta > 0 ? `<span style="font-size: 11px; color: var(--text-sec); opacity: 0.6; margin-right: 15px; font-style: italic;">R$ ${meta.toFixed(2)}</span>` : '';
        
        return `<div class="bank-row" style="cursor:pointer; padding: 8px 0; transition: 0.2s;" onclick="abrirModalOrcamento('${nome}')" onmouseover="this.style.opacity=0.6" onmouseout="this.style.opacity=1">
            <span style="font-weight: 600;">${nome}</span>
            <div style="text-align: right; display:flex; align-items:center; justify-content:flex-end;">
                ${txtMeta} <span style="${corText}">R$ ${valor.toFixed(2)}</span>
            </div>
        </div>`;
    }

    // Força a exibição na lista mesmo que o gasto seja R$ 0,00 (caso o usuário tenha definido uma meta)
    salsiData.config.bancos?.forEach(b => { if(getMetaOrcamento(b, m, a) > 0) bankSum[b] = bankSum[b] || 0; });
    salsiData.config.categorias?.forEach(c => { if(getMetaOrcamento(c, m, a) > 0) tagSum[c] = tagSum[c] || 0; });

    // Renderiza Bancos
    const htmlBancos = Object.entries(bankSum).map(([b,v]) => renderLinhaOrcamento(b, v, false)).join('');
    const temBancos = salsiData.config.bancos && salsiData.config.bancos.length > 0;
    document.getElementById('resumo-bancos-lista').innerHTML = htmlBancos || (temBancos ? '<p style="padding:15px 0; color:#a0aec0; font-size: 13px;">Nenhum gasto registrado.</p>' : '<p style="padding:15px 0; color:#a0aec0; font-size: 13px;">Você ainda não cadastrou cartões.</p>');
    
    // Renderiza Lembretes (Mobile e Novo Menu PC)
    const containerLembretes = document.getElementById('container-lembretes-fatura');
    const containerLembretesPC = document.getElementById('lista-lembretes-pc');
    const notifDot = document.getElementById('notificacao-dot');
    let temAlertaUrgente = false;

    if (containerLembretes) containerLembretes.innerHTML = ''; 
    if (containerLembretesPC) containerLembretesPC.innerHTML = ''; 

    salsiData.config.detalhesBancos?.forEach(ban => {
        const valorFatura = bankSum[ban.nome] || 0;
        if (valorFatura > 0) {
            const hoje = new Date().getDate();
            const vencimento = parseInt(ban.vencimento);
            const diasFaltando = vencimento - hoje;
            
            let bgCor = '#f8faf9', borderCor = '#e2e8f0', statusTexto = `Vence dia ${vencimento}`;
            let textColor = '#1a202c';
            
            // SE A FATURA VENCE EM ATÉ 3 DIAS: O card fica vermelho e acende a bolinha!
            if (diasFaltando <= 3 && diasFaltando >= 0) { 
                bgCor = '#fff5f5'; borderCor = '#feb2b2'; 
                statusTexto = `⚠️ Vence dia ${vencimento}!`; 
                textColor = '#991b1b';
                temAlertaUrgente = true; 
            }

            // A Mágica que extrai só a cor hexadecimal do seu gerador getCor()
            const corBolinhaBanco = getCor(ban.nome).split(';')[0];

            const cardHTML = `
                <div style="background: ${bgCor}; border: 1px solid ${borderCor}; padding: 10px 15px; border-radius: 12px; min-width: 140px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${corBolinhaBanco}"></div>
                            <span style="font-size: 11px; font-weight: 800; color: #4a5568; text-transform: uppercase;">${ban.nome}</span>
                        </div>
                        <span style="font-size: 10px; color: #718096; font-weight: 600;">${statusTexto}</span>
                    </div>
                    <div style="font-size: 14px; font-weight: 800; color: ${textColor}; margin-top: 2px;">R$ ${valorFatura.toFixed(2)}</div>
                </div>`;

            // Desenha na barra rolante do mobile e no menu cascata do PC
            if (containerLembretes) containerLembretes.innerHTML += cardHTML;
            if (containerLembretesPC) containerLembretesPC.innerHTML += cardHTML;
        }
    });

    // Acende ou apaga a bolinha vermelha no PC
    if (notifDot) {
        notifDot.style.display = temAlertaUrgente ? 'block' : 'none';
    }
    
    // Se não tiver faturas, avisa que está tudo limpo
    if (containerLembretesPC && containerLembretesPC.innerHTML === '') {
        containerLembretesPC.innerHTML = '<p style="font-size: 11px; color: var(--text-sec); text-align: center; padding: 10px;">Você não tem faturas para este mês.</p>';
    }

    // Renderiza gráfico de categorias
if (typeof renderizarGraficoCategorias === 'function') {
    renderizarGraficoCategorias(tagSum);
}

    // Renderiza Categorias (Tags)
    const htmlTags = Object.entries(tagSum).map(([k,v]) => renderLinhaOrcamento(k, v, false)).join('');
    const temTags = salsiData.config.categorias && salsiData.config.categorias.length > 0;
    const tagListaEl = document.getElementById('resumo-tags-lista');
    if (tagListaEl) tagListaEl.innerHTML = htmlTags || (temTags ? '<p style="padding:15px 0; color:#a0aec0; font-size: 13px;">Nenhum gasto.</p>' : '<p style="padding:15px 0; color:#a0aec0; font-size: 13px;">Você ainda não cadastrou categorias.</p>');
    
    // Renderiza Entradas!
    const resEntEl = document.getElementById('resumo-entradas-lista');
    if (resEntEl) resEntEl.innerHTML = renderLinhaOrcamento('Total Recebido', totalEnt, true);

    // 7. Finalização e Cache
    const saldoFinal = totalEnt - totalGastoMes;
    document.getElementById('resumo-saldo').innerText = `R$ ${saldoFinal.toFixed(2)}`;
    document.getElementById('resumo-cartao').innerText = `R$ ${totalCartMes.toFixed(2)}`;
    document.getElementById('resumo-porcentagem').innerText = `${totalEnt > 0 ? ((totalGastoMes/totalEnt)*100).toFixed(1) : 0}%`;

    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
	salvarNoFirebase();
    atualizarHumorSalsicha(saldoFinal);
    setTimeout(atualizarGraficoAnual, 100);
    
    // Controle da Aba Ativa ao mudar de mês (Mobile)
    if (window.innerWidth <= 1024) {
        const btnTerceiros = document.getElementById('btn-show-terceiros');
        const cardRes = document.getElementById('card-resumo-conteudo');
        const cardTer = document.getElementById('card-terceiros');

        if (btnTerceiros && btnTerceiros.classList.contains('active')) {
            if(cardRes) cardRes.style.setProperty('display', 'none', 'important');
            if(cardTer) cardTer.style.setProperty('display', 'block', 'important');
        } else {
            if(cardRes) cardRes.style.setProperty('display', 'block', 'important');
            if(cardTer) cardTer.style.setProperty('display', 'none', 'important');
        }
    }

	if (typeof renderizarDesejos === 'function') {
        renderizarDesejos();
    }
	
    atualizarGraficoMeta();

    if (typeof aplicarPrivacidadeValores === 'function') {
    requestAnimationFrame(aplicarPrivacidadeValores);
}

const main = document.querySelector('main');

if (main && main.classList.contains('calendar-mode')) {
    renderizarCalendarioFinanceiro(m, a);
}
}

/* ========================================================= */
/* SIDEBAR - NAVEGAÇÃO DASHBOARD / CALENDÁRIO                */
/* ========================================================= */

let sidebarEntradasExpandida = false;

function marcarViewSidebar(view) {
    document.querySelectorAll('.sidebar-view-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const btn = document.getElementById(
        view === 'calendario' ? 'btn-view-calendario' : 'btn-view-dashboard'
    );

    if (btn) btn.classList.add('active');
}

function irParaDashboard() {
    if (typeof abrirDashboardFinanceira === 'function') {
        abrirDashboardFinanceira();
    }

    marcarViewSidebar('dashboard');
}

function irParaCalendario() {
    if (typeof abrirCalendarioFinanceiro === 'function') {
        abrirCalendarioFinanceiro();
    }

    marcarViewSidebar('calendario');
}

function toggleEntradasSidebar() {
    sidebarEntradasExpandida = !sidebarEntradasExpandida;

    const card = document.getElementById('sidebar-entradas-card');
    const btn = document.getElementById('btn-ver-mais-entradas');

    if (card) {
        card.classList.toggle('is-expanded', sidebarEntradasExpandida);
    }

    if (btn) {
        btn.textContent = sidebarEntradasExpandida ? 'Ver menos' : 'Ver mais';
    }
}

function renderizarGraficoCategorias(tagSum) {
    const chart = document.getElementById('grafico-categorias');
    const legenda = document.getElementById('grafico-categorias-legenda');
    const totalEl = document.getElementById('grafico-categorias-total');
    const totalCentroEl = document.getElementById('grafico-categorias-total-centro');
    const qtdEl = document.getElementById('grafico-categorias-qtd');

    if (!chart || !legenda || !totalEl || !totalCentroEl || !qtdEl) return;

    const cores = [
        '#6CC080', // verde principal
        '#1B4D3E', // verde escuro
        '#8FD5B0', // verde claro
        '#F4C95D', // dourado suave
        '#7AA6A1', // verde acinzentado
        '#B7C9A8', // sálvia
        '#F29C6B', // laranja suave
        '#A9B8C8'  // cinza azulado
    ];

    const entries = Object.entries(tagSum || {})
        .filter(([, valor]) => valor > 0)
        .sort((a, b) => b[1] - a[1]);

    const total = entries.reduce((acc, [, valor]) => acc + valor, 0);
    const topCategorias = entries.slice(0, 6);

    totalEl.textContent = total.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    totalCentroEl.textContent = total.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    qtdEl.textContent = String(entries.length);

    if (!entries.length || total <= 0) {
        chart.style.background = 'conic-gradient(#dfe7e2 0deg 360deg)';
        legenda.innerHTML = `<div class="cat-chart-empty">Sem gastos por categoria neste mês.</div>`;
        return;
    }

    let currentAngle = 0;
    const gap = 2.2; 
    const segments = [];

    topCategorias.forEach(([nome, valor], index) => {
        const cor = cores[index % cores.length];
        const fatia = (valor / total) * 360;
        const inicio = currentAngle;
        const fim = currentAngle + fatia;

        const fimComGap = Math.max(inicio, fim - gap);

        segments.push(`${cor} ${inicio}deg ${fimComGap}deg`);
        segments.push(`rgba(255,255,255,0) ${fimComGap}deg ${fim}deg`);

        currentAngle = fim;
    });

    if (currentAngle < 360) {
        segments.push(`#E5ECE7 ${currentAngle}deg 360deg`);
    }

    chart.style.background = `conic-gradient(${segments.join(', ')})`;

    legenda.innerHTML = topCategorias.map(([nome, valor], index) => {
        const cor = cores[index % cores.length];
        const percentual = ((valor / total) * 100).toFixed(0);

        return `
            <div class="cat-chart-legend-item">
                <span class="cat-chart-legend-color" style="background:${cor};"></span>
                <span class="cat-chart-legend-name">${nome}</span>
                <span class="cat-chart-legend-value">
                    ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span class="cat-chart-legend-percent">${percentual}%</span>
            </div>
        `;
    }).join('');

    if (typeof aplicarPrivacidadeValores === 'function') {
        requestAnimationFrame(aplicarPrivacidadeValores);
    }
}