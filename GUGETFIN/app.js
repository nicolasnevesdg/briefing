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
    verificarLembreteBackup();
	
	// 👇 NOVA VERIFICAÇÃO INTELIGENTE POR CONTA 👇
    // Só abre o tutorial se este usuário logado específico nunca tiver visto
    if (salsiData && salsiData.config && !salsiData.config.tutorialVisto) {
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

function renderizar() {

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
    document.getElementById('lista-entradas').innerHTML = entMes.map(e => {
        const idx = salsiData.entradas.indexOf(e);
        return `<div class="sidebar-list-item">
            <span class="nome-entrada-hover" onclick="verDetalhesEntrada(${idx})" title="Ver Detalhes">${e.nome}</span>
            <div class="sidebar-value">
                R$ ${e.valor.toFixed(2)}
                <button class="btn-del" onclick="excluirEntrada(${idx})" title="Apagar">×</button>
            </div>
        </div>`;
    }).join('');

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
        let mesRef = d.getMonth() + (t.delayPagamento || 0);
        let anoRef = d.getFullYear();

        if (mesRef > 11) { mesRef -= 12; anoRef++; }

        const diff = (a - anoRef) * 12 + (m - mesRef);

        if (diff >= 0 && diff < t.parcelas) {
            const val = t.tipo === 'cartao' ? t.valorParcela : t.valorTotal;
            const idx = salsiData.transacoes.indexOf(t);

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

                const statusChecked = t.pago ? 'checked' : '';

                if(tTable) {
                    // 👇 Visual da linha e Checkbox IGUAIS ao de Fixos 👇
                    const estiloPCTerceiro = t.pago ? '' : 'style="opacity: 0.5; font-style: italic;"';
                    tTable.innerHTML += `
                        <tr class="desktop-only-row" ${estiloPCTerceiro}>
                            <td>${dataSutil}</td>
                            <td style="cursor: pointer; font-weight: 500;" onclick="verDetalhes(${idx})">${t.nome}</td>
                            <td><span class="badge-tag">${t.nomeTerceiro}</span></td>
                            <td style="text-align: center;">${tagTipoPC}</td>
                            <td style="text-align: center;">${diff + 1}/${t.parcelas}</td>
                            <td style="text-align: right; font-weight: 600;">R$ ${val.toFixed(2)}</td>
                            <td style="text-align: center;"><input type="checkbox" ${statusChecked} onchange="alternarStatusPago(${idx})"></td>
                            <td><button class="btn-del" onclick="excluirGasto(${idx})">×</button></td>
                        </tr>`;
                }

                if (mTerceiros) {
                    // 👇 Lógica de opacidade e Tags EXATAMENTE iguais as de Fixos 👇
                    const opacidadeMob = t.pago ? '1' : '0.6'; 
                    const tagStatus = t.pago 
                        ? `<span class="badge" style="background: #21c25e; font-size: 9px;">PAGO</span>`
                        : `<span class="badge-tag" style="background: #f0f2f1; color: #7a8b87; font-size: 9px;">PENDENTE</span>`;

                    mTerceiros.innerHTML += `
                        <div class="cartao-item-mobile" onclick="verDetalhes(${idx})" style="cursor: pointer; opacity: ${opacidadeMob}; transition: 0.2s;">
                            <div class="cartao-info-principal">
                                <div class="cartao-nome-grupo">
                                    <strong>${t.nome}</strong>
                                    <span class="cartao-parcela-tag">${diff + 1}/${t.parcelas}</span>
                                </div>
                                <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                                    <input type="checkbox" ${statusChecked} onclick="event.stopPropagation()" onchange="alternarStatusPago(${idx})" style="transform: scale(1.3); cursor: pointer; accent-color: #21c25e;">
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
                                <td style="cursor: pointer; font-weight: 500; width: 50%;" onclick="verDetalhes(${idx})">${t.nome}</td>
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
                            <div class="cartao-item-mobile" onclick="verDetalhes(${idx})" style="cursor: pointer; opacity: ${opacidadeMob}; transition: 0.2s;">
                                <div class="cartao-info-principal">
                                    <div class="cartao-nome-grupo">
                                        <strong>${t.nome}</strong>
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
                            <tr class="desktop-only-row">
                                <td>${dataSutil}</td>
                                <td style="cursor:pointer; line-height: 1.4;" onclick="verDetalhes(${idx})">
                                    <div style="font-weight: 600; color: var(--text-main);">${t.nome}</div>
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
                            <div class="cartao-item-mobile" onclick="verDetalhes(${idx})" style="cursor: pointer;">
                                <div class="cartao-info-principal">
                                    <div class="cartao-nome-grupo">
                                        <strong>${t.nome}</strong>
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
                            <tr class="desktop-only-row">
                                <td>${dataSutil}</td>
                                <td style="font-weight: 500; cursor: pointer;" onclick="verDetalhes(${idx})">${t.nome}</td>
                                <td style="color: var(--text-sec); font-size: 11px; text-align: center;">${diff + 1}/${t.parcelas}</td>
                                <td style="text-align: center;"><span class="badge" style="background:${getCor(t.banco)}">${t.banco}</span></td>
                                <td style="text-align: right; font-weight: 600;">R$ ${val.toFixed(2)}</td>
                                <td style="text-align: center;"><button class="btn-del" onclick="excluirGasto(${idx})">×</button></td>
                            </tr>`;
                    }

                    if (cMobile) {
                        cMobile.innerHTML += `
                            <div class="cartao-item-mobile" onclick="verDetalhes(${idx})" style="cursor: pointer;">
                                <div class="cartao-info-principal">
                                    <div class="cartao-nome-grupo">
                                        <strong>${t.nome}</strong>
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
}

function ajustarCamposModal() {
    const tipo = document.getElementById('g-tipo').value;
    
    // 1. Mostrar/Esconder o campo Forma de Pagamento (PIX, Débito, Dinheiro)
    const divForma = document.getElementById('div-forma-pagamento');
    if (divForma) {
        divForma.style.display = (tipo === 'debito') ? 'block' : 'none';
    }

    // Captura qual forma de pagamento está selecionada no momento
    const campoForma = document.getElementById('g-forma-pagamento');
    const formaPag = campoForma ? campoForma.value : 'Débito';

    // 2. A mágica para controlar a div do Banco e das Parcelas
    const divCartaoCampos = document.getElementById('div-cartao-campos');
    const inputParcelas = document.getElementById('g-parcelas');
    const selectBanco = document.getElementById('g-banco');

    if (divCartaoCampos) {
        // Se for "Dinheiro", não precisa de banco nem de parcela. Esconde a div inteira.
        if (tipo === 'debito' && formaPag === 'Dinheiro') {
            divCartaoCampos.style.display = 'none';
        } 
        // Se for PIX, Débito em Conta ou Crédito, a div aparece:
        else {
            divCartaoCampos.style.display = 'block';
            
            // Mas a parcela SÓ deve aparecer se for Crédito
            if (inputParcelas) {
                inputParcelas.style.display = (tipo === 'cartao') ? '' : 'none';
            }
            
            // O banco sempre aparece nesses casos
            if (selectBanco) {
                selectBanco.style.display = '';
            }
        }
    }
    
    // CHAMA O FILTRO AQUI PARA ATUALIZAR A LISTA NA HORA QUE TROCAR O TIPO!
    if (typeof atualizarListaBancos === 'function') {
        atualizarListaBancos();
    }
}

function confirmarGasto() {
    let rawValue = document.getElementById('g-valor').value;
    const vTotal = parseFloat(rawValue.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    const tipo = document.getElementById('g-tipo').value; 
    const nParc = Math.max(1, parseInt(document.getElementById('g-parcelas').value) || 1);
    
    const campoForma = document.getElementById('g-forma-pagamento');
    const formaPag = campoForma ? campoForma.value : 'Débito';

    // Lê o campo invisível para saber se estamos editando ou criando
    const indexEditEl = document.getElementById('g-index-edit');
    const indexEdit = indexEditEl ? parseInt(indexEditEl.value) : -1;

    // Monta o pacote de dados com a sua estrutura exata
    const novosDados = {
        nome: document.getElementById('g-nome').value,
        tipo: tipo,
        valorTotal: vTotal,
        valorParcela: vTotal / nParc,
        parcelas: nParc,
        dataCompra: document.getElementById('g-data').value,
        banco: document.getElementById('g-banco').value,
        categoria: document.getElementById('g-categoria').value,
        pago: false, 
        delayPagamento: parseInt(document.getElementById('g-inicio-pagamento').value) || 0,
        eDeTerceiro: document.getElementById('g-terceiro').checked,
        nomeTerceiro: document.getElementById('g-nome-terceiro').value || "",
        formaPagamento: (tipo === 'debito') ? formaPag : null
    };

    if (indexEdit >= 0) {
        // --- MODO EDIÇÃO ---
        // Mantém o status original de "pago" (para não desmarcar se já foi pago)
        novosDados.pago = salsiData.transacoes[indexEdit].pago; 
        salsiData.transacoes[indexEdit] = novosDados;
        mostrarToast("Lançamento atualizado com sucesso!");
    } else {
        // --- MODO CRIAÇÃO ---
        salsiData.transacoes.push(novosDados);
        mostrarToast("Lançamento salvo com sucesso! 💸");
    }
    
    renderizar(); 
    document.getElementById('modal-gasto').close();
}

function alternarStatusPago(index) {
    const gasto = salsiData.transacoes[index];
    gasto.pago = !gasto.pago; // Alterna o status atual

    // Lógica de Automação para o Mês Seguinte
    if (gasto.pago && gasto.tipo === 'fixo') {
        const dataAtual = new Date(gasto.dataCompra + "T00:00:00");
        
        // Cria a data do mês seguinte
        const novaData = new Date(dataAtual);
        novaData.setMonth(novaData.getMonth() + 1);

        // Formata para YYYY-MM-DD
        const dataFormatada = novaData.toISOString().split('T')[0];

        // Verifica se já existe esse gasto no mês seguinte para não duplicar
        const jaExiste = salsiData.transacoes.some(t => 
            t.nome === gasto.nome && 
            t.dataCompra === dataFormatada && 
            t.tipo === 'fixo'
        );

        if (!jaExiste) {
            // Cria a cópia para o mês seguinte (sempre começando como NÃO PAGO)
            const novoGastoFixo = {
                ...gasto,
                dataCompra: dataFormatada,
                pago: false
            };
            salsiData.transacoes.push(novoGastoFixo);
            console.log(`Agendado: ${gasto.nome} para o mês seguinte.`);
        }
    }

    renderizar(); // Atualiza a tela e salva no cache/localStorage
}

function salvarAlteracoes() {
    // Registra o backup para sumir com o banner de aviso
    localStorage.setItem('salsifin_ultimo_backup', new Date().getTime());
	salvarNoFirebase();

    // Gera um nome de arquivo único com data e hora: SalsiFin_Backup_2026-02-18_01h45.js
    const agora = new Date();
    const dataFormatada = agora.toISOString().split('T')[0];
    const horaFormatada = agora.getHours() + 'h' + agora.getMinutes().toString().padStart(2, '0');
    const nomeArquivo = `GugetFin_Backup_${dataFormatada}_${horaFormatada}.js`;

    const conteudo = "const bancoInicial = " + JSON.stringify(salsiData, null, 2) + ";";
    const blob = new Blob([conteudo], { type: "text/javascript" });
    const a = document.createElement("a");
    
    a.href = URL.createObjectURL(blob); 
    a.download = nomeArquivo; // O navegador usará este nome sugerido
    a.click();
}

function confirmarEntrada() {
    let rawValue = document.getElementById('e-valor').value;
    const valorDigitado = parseFloat(rawValue.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    if (valorDigitado <= 0) {
        alert("Por favor, insira um valor válido.");
        return;
    }

    const indexEdit = parseInt(document.getElementById('e-index-edit').value) || -1;
    const nome = document.getElementById('e-nome').value || 'Nova Entrada';
    const cliente = document.getElementById('e-cliente').value || '';
    const dataStr = document.getElementById('e-data').value;
    const categoria = document.getElementById('e-categoria').value;
    
    let parcelas = 1;
    if (categoria === 'Projetos / Serviços') {
        parcelas = parseInt(document.getElementById('e-parcelas').value) || 1;
    }

    let dataBase = new Date();
    if (dataStr) {
        const partesData = dataStr.split('-');
        dataBase = new Date(partesData[0], partesData[1] - 1, partesData[2]);
    } else {
        dataBase.setMonth(dataFiltro.getMonth());
        dataBase.setFullYear(dataFiltro.getFullYear());
    }

    // --- CRIANDO UMA ENTRADA NOVA ---
    if (indexEdit === -1) {
        // Na criação, o 'valorDigitado' é o TOTAL do projeto (ex: 2500)
        const valorPorParcela = valorDigitado / parcelas;
        const projetoId = parcelas > 1 ? 'proj_' + new Date().getTime() : '';

        for (let i = 0; i < parcelas; i++) {
            let dataParcela = new Date(dataBase);
            dataParcela.setMonth(dataParcela.getMonth() + i); 

            salsiData.entradas.push({
                nome: parcelas > 1 ? `${nome} (${i+1}/${parcelas})` : nome,
                cliente: cliente,
                categoria: categoria,
                valor: valorPorParcela, 
                mes: dataParcela.getMonth(),
                ano: dataParcela.getFullYear(),
                dataRecebimento: dataParcela.toISOString().split('T')[0],
                projetoId: projetoId,
                valorTotalProjeto: valorDigitado,
                parcelaAtual: i + 1,
                totalParcelas: parcelas
            });
        }
    } 
    // --- EDITANDO (O CENÁRIO QUE VOCÊ CRIOU) ---
    else {
        // Na edição, o 'valorDigitado' é o valor DESTA parcela (ex: os 1250)
        const entradaEditada = salsiData.entradas[indexEdit];
        
        entradaEditada.nome = nome;
        entradaEditada.cliente = cliente;
        entradaEditada.categoria = categoria;
        entradaEditada.valor = valorDigitado; // Grava os 1250 que o cliente pagou
        
        if (dataStr) {
            entradaEditada.dataRecebimento = dataStr;
            const partesData = dataStr.split('-');
            entradaEditada.mes = parseInt(partesData[1]) - 1;
            entradaEditada.ano = parseInt(partesData[0]);
        }

        // LÓGICA DE RECALCULAR / APAGAR PARCELAS
        if (entradaEditada.projetoId) {
            let parcelasDoProjeto = salsiData.entradas.filter(e => e.projetoId === entradaEditada.projetoId);
            parcelasDoProjeto.sort((a, b) => a.parcelaAtual - b.parcelaAtual);

            // 👇 NOVO: Lê se você aumentou ou diminuiu o orçamento global daquele projeto 👇
            let rawTotalProj = document.getElementById('e-valor-total-projeto').value;
            let novoTotalProjeto = parseFloat(rawTotalProj.replace(/[^\d,]/g, '').replace(',', '.')) || entradaEditada.valorTotalProjeto;
            
            // Atualiza todas as parcelas com esse novo teto de orçamento
            parcelasDoProjeto.forEach(p => p.valorTotalProjeto = novoTotalProjeto);
            entradaEditada.valorTotalProjeto = novoTotalProjeto;
			
            // 1. Descobre quanto o cliente já pagou até este mês
            let somaPagaAteAgora = 0;
            parcelasDoProjeto.forEach(p => {
                if (p.parcelaAtual <= entradaEditada.parcelaAtual) {
                    somaPagaAteAgora += p.valor; 
                }
            });

            // 2. Vê quanto de dinheiro ainda falta e quantas parcelas sobraram
            const saldoRestante = entradaEditada.valorTotalProjeto - somaPagaAteAgora;
            const parcelasFuturasNecessarias = parcelas - entradaEditada.parcelaAtual;

            // 3. Atualiza o número total de parcelas (ex: se mudou pra 3x)
            parcelasDoProjeto.forEach(p => p.totalParcelas = parcelas);

            let parcelasFuturasAtuais = parcelasDoProjeto.filter(p => p.parcelaAtual > entradaEditada.parcelaAtual);

            if (parcelasFuturasNecessarias > 0) {
                const novoValorFuturo = saldoRestante / parcelasFuturasNecessarias;
                
                // Se diminuiu (ex: 4x pra 3x), APAGA a parcela que sobrou lá no futuro!
                while(parcelasFuturasAtuais.length > parcelasFuturasNecessarias) {
                    let pToRemove = parcelasFuturasAtuais.pop();
                    let idxToRemove = salsiData.entradas.indexOf(pToRemove);
                    if(idxToRemove > -1) salsiData.entradas.splice(idxToRemove, 1);
                }

                // Atualiza o valor para as que ficaram
                parcelasFuturasAtuais.forEach(p => p.valor = novoValorFuturo);

                // Se ele AUMENTOU (ex: 3x pra 5x), CRIA as parcelas extras
                let ultimaDataObj = new Date(entradaEditada.ano, entradaEditada.mes, 1);
                for (let i = parcelasFuturasAtuais.length; i < parcelasFuturasNecessarias; i++) {
                    ultimaDataObj.setMonth(ultimaDataObj.getMonth() + 1);
                    salsiData.entradas.push({
                        nome: nome, // Atualizado no final
                        cliente: cliente,
                        categoria: categoria,
                        valor: novoValorFuturo,
                        mes: ultimaDataObj.getMonth(),
                        ano: ultimaDataObj.getFullYear(),
                        dataRecebimento: ultimaDataObj.toISOString().split('T')[0],
                        projetoId: entradaEditada.projetoId,
                        valorTotalProjeto: entradaEditada.valorTotalProjeto,
                        parcelaAtual: entradaEditada.parcelaAtual + i + 1,
                        totalParcelas: parcelas
                    });
                }
            } else {
                // Se pagou tudo agora ou zerou as futuras, apaga o que havia para a frente
                parcelasFuturasAtuais.forEach(pToRemove => {
                    let idxToRemove = salsiData.entradas.indexOf(pToRemove);
                    if(idxToRemove > -1) salsiData.entradas.splice(idxToRemove, 1);
                });
            }

            // 4. Corrige as etiquetas dos nomes para ficar perfeito (ex: (1/3), (2/3))
            let projAtualizado = salsiData.entradas.filter(e => e.projetoId === entradaEditada.projetoId);
            projAtualizado.forEach(p => {
                 p.nome = `${nome} (${p.parcelaAtual}/${p.totalParcelas})`;
            });
        }
    }

    // 🔴 IMPORTANTE: Para evitar bugs com valores fantasma na próxima vez que clicar em "+ ADD"
    const inputValorEl = document.getElementById('e-valor');
    if (inputValorEl) inputValorEl.placeholder = "Valor Total R$"; 

    // 1. Fecha o pop-up primeiro para a tela ficar livre
    document.getElementById('modal-entrada').close();
    
    // 2. Manda o comando para o Firebase salvar os dados em segundo plano
    if (typeof salvarDados === 'function') salvarDados(); 
    
    // 3. Só depois redesenha a tela
    if (typeof renderizar === 'function') renderizar();
}

// Função que faltava: Puxa os dados da entrada para o formulário e abre como Edição
function editarEntrada(index) {
    const modalDet = document.getElementById('modal-detalhes-entrada');
    if(modalDet) modalDet.close();

    const entrada = salsiData.entradas[index];
    if (!entrada) return;

    if (typeof limparFormularioEntrada === 'function') limparFormularioEntrada();

    document.getElementById('modal-titulo-entrada').innerText = 'Editar Parcela';
    document.getElementById('e-index-edit').value = index;
    
    const inputProjId = document.getElementById('e-projeto-id');
    if (inputProjId) inputProjId.value = entrada.projetoId || "";

    const inputValor = document.getElementById('e-valor');
    inputValor.value = (entrada.valor * 100).toFixed(0); 
    if (typeof formatarMoeda === 'function') formatarMoeda(inputValor);

    // 👇 MÁGICA VISUAL: Mostra o Total do Projeto se for parcelado 👇
    const divTotalProj = document.getElementById('div-valor-total-projeto');
    const inputTotalProj = document.getElementById('e-valor-total-projeto');
    
    if (entrada.projetoId && entrada.totalParcelas > 1) {
        if (divTotalProj) divTotalProj.style.display = 'block';
        if (inputTotalProj) {
            inputTotalProj.value = (entrada.valorTotalProjeto * 100).toFixed(0);
            if (typeof formatarMoeda === 'function') formatarMoeda(inputTotalProj);
        }
        inputValor.placeholder = "Valor desta parcela R$"; // O placeholder da parcela
    } else {
        if (divTotalProj) divTotalProj.style.display = 'none';
        inputValor.placeholder = "Valor R$"; // O placeholder normal
    }

    // Remove o " (1/4)" do nome para não poluir a edição
    let nomeLimpo = entrada.nome;
    if (entrada.projetoId) {
        nomeLimpo = entrada.nome.replace(/\s\(\d+\/\d+\)$/, '');
    }
    document.getElementById('e-nome').value = nomeLimpo || "";
    document.getElementById('e-cliente').value = entrada.cliente || "";
    
    let mesStr = (entrada.mes + 1).toString().padStart(2, '0');
    document.getElementById('e-data').value = entrada.dataRecebimento || `${entrada.ano}-${mesStr}-01`;

    document.getElementById('e-categoria').value = entrada.categoria || "Projetos / Serviços";
    if (typeof ajustarCamposEntrada === 'function') ajustarCamposEntrada();
    
    // DESTRAVA AS PARCELAS
    const selectParcelas = document.getElementById('e-parcelas');
    if (entrada.projetoId && entrada.totalParcelas) {
        selectParcelas.value = entrada.totalParcelas.toString();
    }

    document.getElementById('modal-entrada').showModal();
}

function limparFormularioEntrada() {
    const inputEdit = document.getElementById('e-index-edit');
    if (inputEdit) inputEdit.value = "-1";
    
    const inputProjId = document.getElementById('e-projeto-id');
    if (inputProjId) inputProjId.value = "";
    
    // 👇 Esconde a caixa do Total e limpa o valor 👇
    const divTotalProj = document.getElementById('div-valor-total-projeto');
    if (divTotalProj) divTotalProj.style.display = 'none';
    const inputTotalProj = document.getElementById('e-valor-total-projeto');
    if (inputTotalProj) inputTotalProj.value = "";

    document.getElementById('e-valor').placeholder = "Valor Total R$"; // Restaura o placeholder
    document.getElementById('e-valor').value = "";
    document.getElementById('e-nome').value = "";
    document.getElementById('e-cliente').value = "";
    document.getElementById('e-data').value = "";
    document.getElementById('e-categoria').value = "Projetos / Serviços";
    document.getElementById('e-parcelas').value = "1";
    if (typeof ajustarCamposEntrada === 'function') ajustarCamposEntrada();
}

// --- VER DETALHES DA ENTRADA (POP-UP) ---
function verDetalhesEntrada(index) {
    const e = salsiData.entradas[index];
    if (!e) return; 

    document.getElementById('det-ent-nome').innerText = e.nome;
    
    // Tratamento de data
    let dataFormatada = "";
    if (e.dataRecebimento) {
        dataFormatada = new Date(e.dataRecebimento + "T00:00:00").toLocaleDateString('pt-BR');
    } else {
        dataFormatada = `01/${(e.mes + 1).toString().padStart(2, '0')}/${e.ano}`;
    }
    document.getElementById('det-ent-data').innerText = dataFormatada;
    
    document.getElementById('det-ent-valor').innerText = `R$ ${e.valor.toFixed(2)}`;
    document.getElementById('det-ent-cliente').innerText = e.cliente || "-";
    document.getElementById('det-ent-categoria').innerText = e.categoria || "Entrada";

    // Mostra o bloco de projeto só se for parcelado
    const blocoProj = document.getElementById('det-ent-bloco-projeto');
    if (e.projetoId && e.totalParcelas > 1) {
        blocoProj.style.display = 'block';
        document.getElementById('det-ent-projeto-total').innerText = `R$ ${e.valorTotalProjeto.toFixed(2)}`;
        document.getElementById('det-ent-parcela').innerText = `${e.parcelaAtual} de ${e.totalParcelas}`;
    } else {
        blocoProj.style.display = 'none';
    }

	// Conecta os botões do modal à entrada certa
    const btnEditar = document.getElementById('btn-editar-entrada-dinamico');
    if (btnEditar) {
        btnEditar.onclick = () => {
            document.getElementById('modal-detalhes-entrada').close(); 
            editarEntrada(index);
        };
    }

    const btnExcluir = document.getElementById('btn-excluir-entrada-dinamico');
    if (btnExcluir) {
        btnExcluir.onclick = () => { 
            excluirEntrada(index); 
            document.getElementById('modal-detalhes-entrada').close(); 
            renderizar();
        };
    }
	
    document.getElementById('modal-detalhes-entrada').showModal();
}

function excluirGasto(idx) { salsiData.transacoes.splice(idx,1); renderizar(); }
function excluirEntrada(idx) { if(confirm("Apagar?")) { salsiData.entradas.splice(idx,1); renderizar(); } }
function mudarMes(n) { dataFiltro.setMonth(dataFiltro.getMonth() + n); renderizar(); }
// 1. DATA AUTOMÁTICA E RESET AO ABRIR (MODO CRIAÇÃO)
function abrirModalGasto() {
    popularSelects();
    
    // Define a data de hoje no formato YYYY-MM-DD
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('g-data').value = hoje;
    
    // Limpa todos os campos para um novo gasto
    document.getElementById('g-nome').value = '';
    document.getElementById('g-valor').value = '';
    document.getElementById('g-parcelas').value = 1;
    document.getElementById('g-tipo').value = 'cartao';
    document.getElementById('g-inicio-pagamento').value = '0';
    
    const formaPag = document.getElementById('g-forma-pagamento');
    if(formaPag) formaPag.value = 'Débito';

    const checkTerceiro = document.getElementById('g-terceiro');
    if(checkTerceiro) checkTerceiro.checked = false;
    document.getElementById('g-nome-terceiro').value = '';

    // Reseta o visual para Modo Criação
    const titulo = document.getElementById('modal-titulo');
    if (titulo) titulo.innerText = 'Novo Gasto 💸';
    
    // Reseta a memória invisível
    const indexEdit = document.getElementById('g-index-edit');
    if (indexEdit) indexEdit.value = '-1';
    
    if (typeof ajustarCamposModal === 'function') ajustarCamposModal();
    if (typeof toggleCampoNomeTerceiro === 'function') toggleCampoNomeTerceiro();
    
    document.getElementById('modal-gasto').showModal();
}

// 2. NOVA FUNÇÃO: Puxa os dados para o formulário e abre como Edição
function editarGasto(index) {
    document.getElementById('modal-detalhes').close(); 
    
    const t = salsiData.transacoes[index];
    if (!t) return;

    popularSelects();

    const titulo = document.getElementById('modal-titulo');
    if (titulo) titulo.innerText = 'Editar Gasto ✏️';
    
    const indexEdit = document.getElementById('g-index-edit');
    if (indexEdit) indexEdit.value = index;

    // 1. Preenche primeiro os dados básicos e de texto
    document.getElementById('g-nome').value = t.nome || '';
    
    const inputValor = document.getElementById('g-valor');
    inputValor.value = t.valorTotal ? (t.valorTotal * 100).toFixed(0) : '';
    formatarMoeda(inputValor);

    document.getElementById('g-data').value = t.dataCompra || '';
    document.getElementById('g-tipo').value = t.tipo || 'cartao';
    document.getElementById('g-parcelas').value = t.parcelas || 1;
    document.getElementById('g-inicio-pagamento').value = t.delayPagamento || 0;
    
    if (t.tipo === 'debito' && t.formaPagamento) {
        document.getElementById('g-forma-pagamento').value = t.formaPagamento;
    }

    const checkTerceiro = document.getElementById('g-terceiro');
    if (checkTerceiro) checkTerceiro.checked = t.eDeTerceiro || false;
    document.getElementById('g-nome-terceiro').value = t.nomeTerceiro || '';

    // 👇 2. Atualiza o visual e reconstrói as listas vazias ANTES de preencher o banco
    if (typeof ajustarCamposModal === 'function') ajustarCamposModal();
    if (typeof toggleCampoNomeTerceiro === 'function') toggleCampoNomeTerceiro();

    // 👇 3. A MÁGICA: Agora sim, com a lista totalmente pronta, resgata o Banco e Categoria
    if (t.banco) {
         document.getElementById('g-banco').value = t.banco;
    }
    if (t.categoria) {
         document.getElementById('g-categoria').value = t.categoria;
    }

    document.getElementById('modal-gasto').showModal();
}

function abrirModalEntrada() {
    // Tenta limpar os dados antigos de forma segura
    if (typeof limparFormularioEntrada === 'function') {
        limparFormularioEntrada();
    }
    document.getElementById('modal-entrada').showModal();
}

// O Cérebro do Contraste: Define a cor do banco e o contraste legível da letra
// O Cérebro das Cores: Paleta Premium Escurecida (Padronizada para letra Branca)
function getCor(b) {
    const cores = {
        'nubank': '#8A05BE',        
        'inter': '#D46A00',         // Laranja aprofundado (Fica lindo com branco)
        'c6': '#242424',            
        'neon': '#008C99',          // Ciano escurecido (Teal)
        'next': '#009E3A',          // Verde profundo
        'will': '#A39400',          // Amarelo mostarda escuro
        'digio': '#151DE0',
        'iti': '#D1007A',           
        'pan': '#0080C9',           
        'original': '#009E6D',      
        'picpay': '#0D9E57',        
        'mercado pago': '#0084BD',  
        'mercado livre': '#B89C00', // Ouro escurecido
        'pagbank': '#169155',       
        'pagseguro': '#169155',
        'xp': '#000000',            
        'rico': '#D94E00',          
        'clear': '#000000',
        'btg': '#002B49',           
        'itau': '#D96600',          
        'itaú': '#D96600',          
        'bradesco': '#CC092F',      
        'santander': '#D90000',     
        'bb': '#003DA5',            // Azul Marinho Oficial do BB 
        'banco do brasil': '#003DA5',
        'caixa': '#005CA9',         
        'sicredi': '#009643',       
        'sicoob': '#008C7E',        
        'banrisul': '#005CA9',      
        'safra': '#002855',         
        'bmg': '#E65C00',           
        'bv': '#008C4A',            
        'c&a': '#000000',           
        'mais': '#CC323E'           
    };

    let corFundo = '#94a3b8'; // Cor cinza neutra padrão
    
    if (b) {
        const nomeLower = b.toLowerCase();
        for (const [chave, cor] of Object.entries(cores)) {
            if (nomeLower.includes(chave)) {
                corFundo = cor;
                break;
            }
        }
    }

    // Retorna a cor de fundo adaptada e OBRIGA o texto a ser branco e sem bordas perdidas
    return `${corFundo}; color: #ffffff !important; border: none !important;`;
}

function importarDadosJS(event) { 
    const leitor = new FileReader(); 
    leitor.onload = function(e) { 
        try { 
            let conteudo = e.target.result.replace(/const bancoInicial\s*=\s*/, "").trim().replace(/;$/, ""); 
            salsiData = JSON.parse(conteudo); 
            localStorage.setItem('salsifin_cache', JSON.stringify(salsiData)); 
            
            renderizar(); 
            
            // 👇 ENVIA O BACKUP PARA A NUVEM IMEDIATAMENTE 👇
            salvarNoFirebase(); 
            
            alert("Importado! 🐾"); 
        } catch (erro) { 
            alert("Erro!"); 
        } 
    }; 
    leitor.readAsText(event.target.files[0]); 
}

function atualizarGraficoAnual() {
    const canvas = document.getElementById('graficoSalsi');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const ano = anoFiltroGrafico; 
    
    // LÊ A OPÇÃO DO NOVO DROPDOWN PREMIUM
    const filtroEl = document.getElementById('filtro-tipo-grafico');
    const tipoVisao = filtroEl ? filtroEl.getAttribute('data-value') : 'saldo';

    const dados = Array(12).fill(0);

    // Variáveis que vão alimentar os 4 painéis de totais do ano
    let anEnt = 0;
    let anCred = 0;
    let anDeb = 0;
    let anFixo = 0;

    for (let m = 0; m < 12; m++) {
        let entradasDoMes = salsiData.entradas
            .filter(e => e.mes === m && e.ano === ano)
            .reduce((acc, curr) => acc + curr.valor, 0);
        
        anEnt += entradasDoMes; // Soma pro painel

        let gastosDoMes = 0;

        salsiData.transacoes.forEach(t => {
            const d = new Date(t.dataCompra + "T00:00:00");
            
            let mesRef = d.getMonth() + (t.delayPagamento || 0);
            let anoRef = d.getFullYear();
            if (mesRef > 11) { mesRef -= 12; anoRef++; }
            
            const diff = (ano - anoRef) * 12 + (m - mesRef);

            if (diff >= 0 && diff < t.parcelas && !t.eDeTerceiro) {
                const v = t.tipo === 'cartao' ? t.valorParcela : t.valorTotal;
                if (t.tipo !== 'fixo' || (t.tipo === 'fixo' && t.pago === true)) {
                    gastosDoMes += v;

                    // Soma pro painel
                    if (t.tipo === 'cartao') anCred += v; 
                    else if (t.tipo === 'debito') anDeb += v; 
                    else anFixo += v;
                }
            }
        });

        // Decide a linha
        if (tipoVisao === 'entradas') {
            dados[m] = entradasDoMes;
        } else if (tipoVisao === 'saidas') {
            dados[m] = gastosDoMes;
        } else {
            dados[m] = entradasDoMes - gastosDoMes; 
        }
    }

    // ATUALIZA OS 4 PAINÉIS DE TOTAIS EMBAIXO DO GRÁFICO NA HORA
    const eAnnEntradas = document.getElementById('ann-entradas');
    if(eAnnEntradas) {
        eAnnEntradas.innerText = `R$ ${anEnt.toFixed(2)}`;
        document.getElementById('ann-saidas').innerText = `R$ ${(anCred + anDeb + anFixo).toFixed(2)}`;
        document.getElementById('ann-credito').innerText = `R$ ${anCred.toFixed(2)}`;
        document.getElementById('ann-debito').innerText = `R$ ${anDeb.toFixed(2)}`;
    }

    if (window.meuGrafico) window.meuGrafico.destroy();

    const isDark = document.body.classList.contains('dark-theme');
    let corLinha, corFundo, corPonto;

    // CORES DINÂMICAS: Verde, Vermelho ou Teal
    if (tipoVisao === 'entradas') {
        corLinha = '#10b981'; 
        corFundo = isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)';
    } else if (tipoVisao === 'saidas') {
        corLinha = '#ef4444'; 
        corFundo = isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    } else {
        corLinha = isDark ? '#14b8a6' : '#96e6a1'; 
        corFundo = isDark ? 'rgba(20, 184, 166, 0.1)' : 'rgba(150, 230, 161, 0.1)';
    }
    
    corPonto = isDark ? '#1e293b' : '#1b3a32';

    window.meuGrafico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"],
            datasets: [{
                data: dados,
                borderColor: corLinha,
                backgroundColor: corFundo,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 4, 
                pointBackgroundColor: corPonto
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }, 
            },
            scales: {
                y: { display: false, padding: 20 },
                x: { grid: { display: false }, ticks: { color: isDark ? '#94a3b8' : '#7a8b87', font: { size: 10 } } }
            }
        }
    });
}

// --- CONTROLE DO NOVO FILTRO DO GRÁFICO ---
function toggleDropdownGrafico(e) {
    e.stopPropagation();
    // Fecha os outros dropdowns caso estejam abertos
    document.querySelectorAll('.custom-dropdown').forEach(d => {
        if (d.id !== 'filtro-tipo-grafico') d.classList.remove('active');
    });
    // Abre/fecha este
    document.getElementById('filtro-tipo-grafico').classList.toggle('active');
}

function selecionarFiltroGrafico(valor, texto, event) {
    const container = document.getElementById('filtro-tipo-grafico');
    
    // 1. Atualiza o texto e o valor oculto
    container.setAttribute('data-value', valor);
    document.getElementById('texto-filtro-grafico').innerText = texto;
    
    // 2. Muda a cor de quem está selecionado na lista
    const items = container.querySelectorAll('.dropdown-item');
    items.forEach(i => i.classList.remove('selected'));
    if (event) event.target.classList.add('selected');
    
    // 3. Fecha o menu e RECARREGA O GRÁFICO
    container.classList.remove('active');
    atualizarGraficoAnual();
}

// 1. Abre/Fecha o menu cascata do Mobile
function toggleMenuOpcoes(event) {
    event.stopPropagation();
    document.getElementById('menu-dropdown').classList.toggle('active');
}

// NOVA: Abre/Fecha o menu cascata do PC
function toggleMenuOpcoesPC(event) {
    event.stopPropagation();
    document.getElementById('menu-dropdown-pc').classList.toggle('active');
}

// 2. Lógica global para fechar os menus ao clicar em qualquer lugar da tela
document.addEventListener('click', function(event) {
    // Verifica e fecha o do Mobile
    const menuMob = document.getElementById('menu-dropdown');
    const contMob = document.getElementById('container-opcoes');
    if (menuMob && menuMob.classList.contains('active') && contMob && !contMob.contains(event.target)) {
        menuMob.classList.remove('active');
    }
    
    // Verifica e fecha o do PC
    const menuPC = document.getElementById('menu-dropdown-pc');
    const contPC = document.getElementById('container-opcoes-pc');
    if (menuPC && menuPC.classList.contains('active') && contPC && !contPC.contains(event.target)) {
        menuPC.classList.remove('active');
    }
});

// 2. Lógica para fechar ao clicar em qualquer lugar da tela
document.addEventListener('click', function(event) {
    const menu = document.getElementById('menu-dropdown');
    const container = document.getElementById('container-opcoes');
    if (menu && menu.classList.contains('active') && !container.contains(event.target)) {
        menu.classList.remove('active');
    }
});

// --- SISTEMA DE ACORDEON INTELIGENTE (PLANEJAMENTO) ---

// Função nova: Fecha os outros cards automaticamente no PC
function fecharOutrosPlanejamento(excecaoId) {
    if (window.innerWidth <= 1024) return; // No celular, continua livre (pode abrir todos)

    const listas = [
        { id: 'card-grafico', icon: 'chart-toggle-icon' },
        { id: 'card-metas-acordeon', icon: 'meta-toggle-icon' },
        { id: 'card-desejos-acordeon', icon: 'desejo-toggle-icon' }
    ];

    listas.forEach(item => {
        if (item.id !== excecaoId) {
            const card = document.getElementById(item.id);
            const icone = document.getElementById(item.icon);
            if (card && card.classList.contains('expanded')) {
                card.classList.remove('expanded');
                if (icone) icone.style.transform = 'rotate(-135deg)';
            }
        }
    });
}

function toggleGrafico() {
    fecharOutrosPlanejamento('card-grafico'); // Força os vizinhos a fecharem
    
    const card = document.getElementById('card-grafico');
    const seta = document.getElementById('chart-toggle-icon');
    
    card.classList.toggle('expanded');
    
    if (card.classList.contains('expanded')) {
        seta.style.transform = 'rotate(0deg)';
        setTimeout(atualizarGraficoAnual, 100);
    } else {
        seta.style.transform = 'rotate(-135deg)'; 
    }
}

// 1. Abre o modal e lista os cartões atuais
function abrirModalCartoes() {
    const lista = document.getElementById('lista-cartoes-config');
    const cartoes = salsiData.config.detalhesBancos || [];

    lista.innerHTML = cartoes.length > 0 ? cartoes.map((c, index) => {
        // MÁGICA VISUAL: Substitui o "null" por uma etiqueta elegante ou por um traço
        const infoDatas = c.isDebitoOnly 
            ? `<span style="font-size: 10px; color: var(--text-sec); font-weight: 600;">Cartão de Débito</span>` 
            : `Fecha: ${c.fechamento || '--'} | Vence: ${c.vencimento || '--'}`;

        return `
        <div class="cartao-item-card">
            <div>
                <span class="badge" style="background: ${getCor(c.nome)}; margin-bottom: 6px; display: inline-block;">${c.nome}</span>
                <div style="font-size: 10px; color: var(--text-sec); font-weight: 600;">
                    ${infoDatas}
                </div>
            </div>
            <button class="btn-del" onclick="excluirCartaoConfig(${index})">×</button>
        </div>
    `}).join('') : "<p style='font-size:12px; opacity:0.5'>Nenhum cartão.</p>";

    document.getElementById('modal-cartoes').showModal();
}

// 2. Adiciona um novo cartão ao banco de dados
function adicionarNovoCartao() {
    let nome = document.getElementById('nc-nome').value.trim();
    const checkbox = document.getElementById('banco-apenas-debito');
    const isDebito = checkbox ? checkbox.checked : false;

    if (!nome) {
        alert("Preencha o nome do cartão!");
        return;
    }

    // 1. Mágica do Nome: Adiciona o sufixo automaticamente se for só débito
    if (isDebito) {
        nome += " (Débito)";
    }

    // 2. Mágica das Datas: Ignora as datas se for débito
    const fechamento = isDebito ? null : parseInt(document.getElementById('nc-fechamento').value);
    const vencimento = isDebito ? null : parseInt(document.getElementById('nc-vencimento').value);

    // Se NÃO for débito, obriga a ter datas
    if (!isDebito && (!fechamento || !vencimento)) {
        alert("Preencha as datas para cartões de crédito!");
        return;
    }

    if (!salsiData.config.detalhesBancos) salsiData.config.detalhesBancos = [];
    
    // 3. Salva no banco com a tag invisível
    salsiData.config.detalhesBancos.push({ 
        nome: nome, 
        fechamento: fechamento, 
        vencimento: vencimento,
        isDebitoOnly: isDebito 
    });
    salsiData.config.bancos = salsiData.config.detalhesBancos.map(b => b.nome);

    // Limpa campos e reseta a caixinha
    document.getElementById('nc-nome').value = '';
    document.getElementById('nc-fechamento').value = '';
    document.getElementById('nc-vencimento').value = '';
    if (checkbox) {
        checkbox.checked = false;
        toggleInputsDebito(); // Reseta o visual opaco
    }
    
    popularSelects();
    abrirModalCartoes(); 
    renderizar(); 
}

// 3. Remove o cartão da lista de opções (mantém no histórico)
function excluirCartaoConfig(index) {
    if (confirm("Deseja ocultar este cartão das novas opções? (Gastos antigos não serão afetados)")) {
        salsiData.config.detalhesBancos.splice(index, 1);
        salsiData.config.bancos = salsiData.config.detalhesBancos.map(b => b.nome);
        popularSelects();
        abrirModalCartoes();
        renderizar();
    }
}

// 1. Função para Resetar TUDO na Nuvem e no Local
async function limparTudo() {
    if (confirm("⚠️ ATENÇÃO: Isso apagará todos os seus gastos na nuvem e no navegador. Deseja continuar?")) {
        
        // Substitui os dados atuais pelo novo "esqueleto" perfeito
        salsiData = {
            config: { 
                categorias: [
                    "Alimentação", "Assinaturas", "Lazer", "Outros", 
                    "Transporte", "Presentes", "Saúde/Estética", 
                    "Compras", "Mercado", "Fixos", "Terceiros"
                ], 
                bancos: ["Cadastre seus cartões!"],
                detalhesBancos: [
                    { nome: "Cadastre seus cartões!", fechamento: 10, vencimento: 20 }
                ]
            },
            entradas: [], transacoes: [], metas: []
        };
        
        // Manda o esqueleto vazio pra nuvem
        await salvarNoFirebase(); 
        
        // Limpa o navegador e reinicia
        localStorage.removeItem('salsifin_cache');
        location.reload(); 
    }
}

// 2. Função para Limpar apenas o Mês Atual que você está visualizando
function limparMesAtual() {
    const m = dataFiltro.getMonth();
    const a = dataFiltro.getFullYear();
    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    if (confirm(`Deseja apagar todos os gastos e entradas de ${mesesNomes[m]} de ${a}?`)) {
        // Filtra as transações para manter apenas o que NÃO for do mês/ano atual
        salsiData.transacoes = salsiData.transacoes.filter(t => {
            const d = new Date(t.dataCompra + "T00:00:00");
            return !(d.getMonth() === m && d.getFullYear() === a);
        });

        // Filtra as entradas também
        salsiData.entradas = salsiData.entradas.filter(e => !(e.mes === m && e.ano === a));

        renderizar(); // Atualiza a tela e salva no cache
    }
}

// No topo do arquivo, junto com as outras variáveis
let anoFiltroGrafico = new Date().getFullYear();

// No final do arquivo
function mudarAnoGrafico(n) {
    anoFiltroGrafico += n;
    document.getElementById('ano-badge-dinamico').innerText = anoFiltroGrafico;
    atualizarGraficoAnual(); // Redesenha apenas o gráfico
}

// --- GESTÃO DE CATEGORIAS (TAGS) ---

// 1. Função para abrir o modal e listar as categorias atuais
function abrirModalCategorias() {
    const lista = document.getElementById('lista-tags-config');
    // Busca as categorias do seu banco de dados ou cria um array vazio se não houver
    const tags = salsiData.config.categorias || [];

	lista.innerHTML = tags.length > 0 ? tags.map((tag, index) => `
		<div class="cartao-item-card">
			<div style="display: flex; align-items: center; gap: 10px;">
				<span class="system-icon">🏷️</span>
				<strong style="color: var(--dark-green); text-transform: uppercase; font-size: 11px;">${tag}</strong>
			</div>
			<button class="btn-del" onclick="excluirTagConfig(${index})">×</button>
		</div>
	`).join('') : "<p style='font-size:12px; opacity:0.5; padding:10px;'>Nenhuma tag cadastrada.</p>";

    document.getElementById('modal-categorias').showModal();
}

// 2. Função para salvar uma nova categoria digitada
function adicionarNovaTag() {
    const input = document.getElementById('nt-nome');
    const nome = input.value.trim();

    if (!nome) {
        alert("Digite um nome para a categoria!");
        return;
    }

    // Adiciona ao banco de dados
    if (!salsiData.config.categorias) salsiData.config.categorias = [];
    salsiData.config.categorias.push(nome);
    
    // Limpa o campo e atualiza tudo
    input.value = '';
    popularSelects(); // ESSA LINHA é o que faz a tag aparecer no formulário de "Novo Gasto"
    abrirModalCategorias(); // Atualiza a lista visual no pop-up
    renderizar(); // Salva no cache
}

// 3. Função para excluir uma categoria
function excluirTagConfig(index) {
    if (confirm("Deseja remover esta categoria? (Isso não apaga gastos antigos)")) {
        salsiData.config.categorias.splice(index, 1);
        popularSelects();
        abrirModalCategorias();
        renderizar();
    }
}

function verDetalhes(index) {
    const t = salsiData.transacoes[index];
    if (!t) return; 

    document.getElementById('det-nome').innerText = t.nome;
    document.getElementById('det-data').innerText = new Date(t.dataCompra + "T00:00:00").toLocaleDateString('pt-BR');
    document.getElementById('det-valor-total').innerText = `R$ ${t.valorTotal.toFixed(2)}`;
    document.getElementById('det-categoria').innerText = t.categoria;

    // --- NOVA LÓGICA: IDENTIDADE DE PAGAMENTO ---
    let textoPagamento = t.banco; // Fallback padrão
    
    if (t.tipo === 'debito') {
        const forma = t.formaPagamento || 'Débito'; // Puxa se foi PIX, Dinheiro ou Débito
        // Se for dinheiro, não precisa mostrar banco. Se for PIX/Débito, mostra o banco entre parênteses.
        textoPagamento = (forma === 'Dinheiro') ? 'Dinheiro Físico' : `${forma} (${t.banco})`;
    } else if (t.tipo === 'cartao') {
        textoPagamento = `Crédito (${t.banco})`;
    } else if (t.tipo === 'fixo') {
        textoPagamento = `Gasto Fixo`; // Fixos geralmente debitam em conta
    }

    // Aplica no modal
    document.getElementById('det-banco').innerText = textoPagamento;

    // Lógica de Parcelas
    const blocoParc = document.getElementById('det-bloco-parcelas');
    if (t.parcelas > 1) {
        blocoParc.style.display = 'block';
        document.getElementById('det-valor-parcela').innerText = `R$ ${t.valorParcela.toFixed(2)}`;
        document.getElementById('det-qtd-parcelas').innerText = t.parcelas;
    } else {
        blocoParc.style.display = 'none';
    }

	// 🔌 Conecta os botões novos ao gasto correto (index)
    const btnEditar = document.getElementById('btn-editar-dinamico');
    if (btnEditar) {
        btnEditar.onclick = () => {
            document.getElementById('modal-detalhes').close(); // Força o fecho
            
            // O Atraso que resolve o bug:
            setTimeout(() => {
                editarGasto(index); 
            }, 100); 
        };
    }

    const btnExcluir = document.getElementById('btn-excluir-dinamico');
    if (btnExcluir) {
        btnExcluir.onclick = () => { 
            // Substitua 'excluirGasto' pelo nome exato da sua função de excluir, se for diferente
            excluirGasto(index); 
            document.getElementById('modal-detalhes').close(); 
            renderizar();
        };
    }
	
    document.getElementById('modal-detalhes').showModal();
}

function toggleCampoNomeTerceiro() {
    const check = document.getElementById('g-terceiro').checked;
    document.getElementById('div-nome-terceiro').style.display = check ? 'block' : 'none';
}

// 2. MÁSCARA DE MOEDA EM TEMPO REAL (Transforma 100 em R$ 100,00)
function formatarMoeda(input) {
    let valor = input.value.replace(/\D/g, ""); // Remove tudo que não é dígito
    
    if (valor === "") {
        input.value = "";
        return;
    }

    valor = (parseInt(valor) / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    input.value = valor;
}


// Garante que o banco use a lista (plural)
if (!salsiData.metas) salsiData.metas = [];

function salvarMeta() {
    const nome = document.getElementById('meta-nome').value;
    const total = parseFloat(document.getElementById('meta-valor-total').value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    const atual = parseFloat(document.getElementById('meta-valor-atual').value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    const idExistente = document.getElementById('modal-meta').dataset.id;

    if (idExistente) {
        // Modo Edição: Atualiza a meta existente
        const index = salsiData.metas.findIndex(m => m.id == idExistente);
        if (index !== -1) salsiData.metas[index] = { nome, total, atual, id: Number(idExistente) };
    } else {
        // Modo Novo: Adiciona na lista
        salsiData.metas.push({ nome, total, atual, id: Date.now() });
    }

    delete document.getElementById('modal-meta').dataset.id; // Limpa o ID após salvar
    document.getElementById('modal-meta').close();
    renderizar();
}

function abrirEdicaoMeta(id) {
    const meta = salsiData.metas.find(m => m.id === id);
    if (!meta) return;

    // Preenche o modal com os dados atuais
    document.getElementById('meta-nome').value = meta.nome;
    document.getElementById('meta-valor-total').value = meta.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('meta-valor-atual').value = meta.atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    document.getElementById('modal-meta').dataset.id = id; // Marca que estamos editando
    document.getElementById('modal-meta').showModal();
}

function excluirMeta(id) {
    if (confirm("Deseja apagar esta meta?")) {
        salsiData.metas = salsiData.metas.filter(m => m.id !== id);
        renderizar();
    }
}

function atualizarGraficoMeta() {
    const container = document.getElementById('conteudo-meta');
    if (!container) return;

    // ESTADO VAZIO: Botão centralizado para criar a primeira
    if (salsiData.metas.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 0;">
                <p style="color: #7a8b87; font-size: 13px; margin-bottom: 15px;">Você ainda não traçou nenhum objetivo.</p>
                <button onclick="document.getElementById('modal-meta').showModal()" class="btn-novo-gasto" style="width: auto; padding: 10px 25px; margin: 0;">+ Criar Primeira Meta</button>
            </div>`;
        return;
    }

    // COM DADOS: Botão "+ Nova Meta" no topo do conteúdo e Grid de metas
    container.innerHTML = `
        <div style="display: flex; justify-content: flex-end;">
            <button onclick="document.getElementById('modal-meta').showModal()" class="btn-novo-gasto" style="width: auto; padding: 6px 15px; font-size: 11px; margin: 0;">+ Nova Meta</button>
        </div>
        <div id="grid-metas" style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; padding: 20px 0 30px 0;"></div>`;

salsiData.metas.forEach(meta => {
    const canvasId = `chart-${meta.id}`;
    const perc = Math.min(100, (meta.atual / meta.total) * 100);
    const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    document.getElementById('grid-metas').innerHTML += `
    <div class="meta-item-card">
        <button class="btn-del-meta" onclick="excluirMeta(${meta.id})">×</button>
        <h4 class="meta-titulo">${meta.nome}</h4>
        
        <div class="meta-chart-wrapper">
            <canvas id="${canvasId}"></canvas>
            <div class="meta-percentage">${perc.toFixed(0)}%</div>
        </div>
        
        <div class="meta-info-valores">
            <span class="v-atual">R$ ${fmt(meta.atual)}</span> 
            <span class="v-total">R$ ${fmt(meta.total)}</span>
        </div>
        
        <button class="btn-editar-meta-simples" onclick="abrirEdicaoMeta(${meta.id})">
            Editar Meta
        </button>
    </div>`;

        setTimeout(() => {
            const ctx = document.getElementById(`chart-${meta.id}`).getContext('2d');
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [meta.atual, Math.max(0, meta.total - meta.atual)],
                        backgroundColor: ['#96e6a1', '#f0f2f1'],
                        borderWidth: 0,
                        borderRadius: 6
                    }]
                },
                options: { cutout: '82%', plugins: { legend: { display: false } }, maintainAspectRatio: false }
            });
        }, 150);
    });
}

function toggleMetas() {
    fecharOutrosPlanejamento('card-metas-acordeon'); // Força os vizinhos a fecharem
    
    const card = document.getElementById('card-metas-acordeon');
    const seta = document.getElementById('meta-toggle-icon');
    
    card.classList.toggle('expanded');
    
    if (card.classList.contains('expanded')) {
        seta.style.transform = 'rotate(0deg)';
        setTimeout(atualizarGraficoMeta, 100); 
    } else {
        seta.style.transform = 'rotate(-135deg)';
    }
}

function verificarLembreteBackup() {
    const ultimoBackup = localStorage.getItem('salsifin_ultimo_backup');
    const agora = new Date().getTime();
    const tresDias = 3 * 24 * 60 * 60 * 1000; // Milissegundos em 3 dias

    // Se nunca fez backup ou se passaram 3 dias
    if (!ultimoBackup || (agora - ultimoBackup) > tresDias) {
        exibirBannerBackup();
    }
}

function exibirBannerBackup() {
    // Evita duplicar o banner
    if (document.getElementById('banner-backup')) return;

    const main = document.querySelector('main');
    const banner = document.createElement('div');
    banner.id = 'banner-backup';
    banner.style = `
        background: #fff4e5; 
        border: 1px solid #ffe2b3; 
        padding: 15px; 
        margin-bottom: 20px; 
        border-radius: 12px; 
        display: flex; 
        flex-direction: column; 
        gap: 8px;
        animation: fadeIn 0.5s ease;
    `;

    banner.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <strong style="color: #856404; font-size: 13px;">SEGURANÇA DOS DADOS</strong>
            <button onclick="fecharBannerBackup()" style="background:none; border:none; cursor:pointer; color:#856404;">×</button>
        </div>
        <p style="font-size: 12px; color: #856404; margin: 0; line-height: 1.4;">
            Como o sistema é local, seus dados ficam salvos apenas no cache deste navegador. 
            Se você limpar o histórico, perderá sua organização. 
            Vá em <strong>SISTEMA > OPÇÕES</strong> e exporte seus dados para garantir seu backup.
        </p>
    `;
    
    main.prepend(banner);
}

function fecharBannerBackup() {
    // Ao fechar, o sistema entende que você "fez" o backup (ou foi avisado) e renova o prazo de 3 dias
    localStorage.setItem('salsifin_ultimo_backup', new Date().getTime());
    const banner = document.getElementById('banner-backup');
    if (banner) banner.remove();
}

function navegar(abaId) {
    // 1. Esconde tudo com força total (Limpa a tela e remove o menu de cartões se estiver aberto)
    document.querySelectorAll('.tab-content').forEach(secao => {
        secao.classList.remove('active');
        secao.style.setProperty('display', 'none', 'important');
    });

    // 2. LÓGICA ESPECIAL PARA A HOME
    if (abaId === 'home') {
        const homePrincipal = document.getElementById('aba-home');
        const homeResumo = document.getElementById('aba-resumo-home');

        if (homePrincipal) {
            homePrincipal.classList.add('active');
            homePrincipal.style.setProperty('display', 'block', 'important');
        }
        if (homeResumo) {
            homeResumo.classList.add('active');
            homeResumo.style.setProperty('display', 'block', 'important');
        }
    } 
    // 3. LÓGICA ESPECIAL PARA CARTÕES (Exibe Menu + Conteúdo)
    else if (abaId === 'cartao' || abaId === 'debito') {
        const menuCartoes = document.getElementById('menu-cartoes');
        const abaConteudo = document.getElementById('aba-debito'); // Sua base de cartões

        if (menuCartoes) {
            menuCartoes.classList.add('active');
            menuCartoes.style.setProperty('display', 'block', 'important');
        }
        if (abaConteudo) {
            abaConteudo.classList.add('active');
            abaConteudo.style.setProperty('display', 'block', 'important');
            // Chama a função que gerencia qual card (crédito ou débito) aparece
            toggleSubCartao(subAbaCartaoAtiva);
        }
    }
    // 4. LÓGICA PARA AS OUTRAS ABAS (FIXOS, ENTRADAS, ETC)
    else {
        const abaAtiva = document.getElementById(`aba-${abaId}`);
        if (abaAtiva) {
            abaAtiva.classList.add('active');
            abaAtiva.style.setProperty('display', 'block', 'important');
        } else {
            console.error("Erro: Secção não encontrada ->", `aba-${abaId}`);
        }
    }

	window.scrollTo(0, 0);

    // 👇 MÁGICA VISUAL: Troca a cor da aba na barra flutuante inferior 👇
    document.querySelectorAll('.mobile-tab-bar .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(abaId)) {
            btn.classList.add('active');
        }
    });
}

function toggleSubAba(alvo) {
    // IDs exatos conforme o seu código HTML
    const cardRes = document.getElementById('card-resumo-conteudo');
    const cardTer = document.getElementById('card-terceiros');
    const btnRes = document.getElementById('btn-show-resumo');
    const btnTer = document.getElementById('btn-show-terceiros');

    if (!cardRes || !cardTer || !btnRes || !btnTer) {
        console.error("Erro: Verifique se os IDs card-resumo-conteudo, card-terceiros, btn-show-resumo e btn-show-terceiros existem!");
        return;
    }

    if (alvo === 'resumo') {
        // Ativa botão Resumo
        btnRes.classList.add('active');
        btnTer.classList.remove('active');

        // Alterna Cards
        cardRes.style.setProperty('display', 'block', 'important');
        cardTer.style.setProperty('display', 'none', 'important');
    } else {
        // Ativa botão Terceiros
        btnRes.classList.remove('active');
        btnTer.classList.add('active');

        // Alterna Cards
        cardRes.style.setProperty('display', 'none', 'important');
        cardTer.style.setProperty('display', 'block', 'important');
    }
}

function toggleSubCartao(alvo) {
    subAbaCartaoAtiva = alvo;
    
    // Pegamos os elementos
    const cardDeb = document.getElementById('sub-card-debito');
    const cardCred = document.getElementById('sub-card-credito');
    const btnCred = document.getElementById('btn-sub-credito');
    const btnDeb = document.getElementById('btn-sub-debito');
    
    // Pegamos as sections (Abas pai)
    const secDebito = document.getElementById('aba-debito');
    const secCredito = document.getElementById('aba-cartao');

    if (window.innerWidth <= 1024) {
        // AMBAS as sections pai ficam visíveis (para os botões não sumirem)
        if(secDebito) secDebito.style.setProperty('display', 'block', 'important');
        if(secCredito) secCredito.style.setProperty('display', 'block', 'important');

        if (alvo === 'credito') {
            // Mostra conteúdo de Crédito, esconde o de Débito
            if(cardCred) cardCred.style.setProperty('display', 'block', 'important');
            if(cardDeb) cardDeb.style.setProperty('display', 'none', 'important');
            btnCred.classList.add('active');
            btnDeb.classList.remove('active');
        } else {
            // Mostra conteúdo de Débito, esconde o de Crédito
            if(cardCred) cardCred.style.setProperty('display', 'none', 'important');
            if(cardDeb) cardDeb.style.setProperty('display', 'block', 'important');
            btnCred.classList.remove('active');
            btnDeb.classList.add('active');
        }
    }
}

window.onload = iniciar;

// --- NOVA LÓGICA DE SWIPE GLOBAL E ANIMADA (TELA INTEIRA) ---
let touchstartX = 0;
let touchstartY = 0;
let touchendX = 0;
let touchendY = 0;

// Escuta o toque na tela inteira
document.addEventListener('touchstart', function(event) {
    touchstartX = event.changedTouches[0].screenX;
    touchstartY = event.changedTouches[0].screenY;
}, {passive: true});

// Escuta quando o dedo solta
document.addEventListener('touchend', function(event) {
    touchendX = event.changedTouches[0].screenX;
    touchendY = event.changedTouches[0].screenY;
    analisarMovimentoSwipe();
}, {passive: true});

function analisarMovimentoSwipe() {
    // 👇 TRAVA DE SEGURANÇA: Se houver algum pop-up aberto, ignora o arrasto!
    if (document.querySelector('dialog[open]')) return;

    const distanciaX = touchendX - touchstartX;
    const distanciaY = touchendY - touchstartY;

    // Só ativa se arrastou pros lados (ignora se estiver rolando a tela pra baixo)
    if (Math.abs(distanciaX) > Math.abs(distanciaY)) {
        
        // Arrasto maior que 60px (para não ser sensível demais)
        if (Math.abs(distanciaX) > 60) {
            
            // Pega a sua barra de navegação que já existe no HTML
            const navMovel = document.getElementById('mobile-month-nav');
            
            if(navMovel) {
                // Limpa animações anteriores para rodar liso de novo
                navMovel.classList.remove('anim-slide-left', 'anim-slide-right');
                void navMovel.offsetWidth; 
            }

            if (distanciaX < 0) {
                // Arrastou para ESQUERDA (Avança o mês)
                mudarMes(1); 
                if(navMovel) navMovel.classList.add('anim-slide-left');
                
            } else {
                // Arrastou para DIREITA (Volta o mês)
                mudarMes(-1);
                if(navMovel) navMovel.classList.add('anim-slide-right');
            }
        }
    }
}

// --- CRIA OS DROPDOWNS CUSTOMIZADOS ---
function preencherFiltrosDropdown() {
    const preencherCustom = (id, lista, textoPadrao) => {
        const container = document.getElementById(id);
        if (!container) return;
        
        const menu = container.querySelector('.dropdown-menu');
        const triggerText = container.querySelector('.dropdown-trigger span');
        let valorSalvo = container.getAttribute('data-value') || 'Todos';

        if (valorSalvo !== 'Todos' && !lista.includes(valorSalvo)) valorSalvo = 'Todos';
        container.setAttribute('data-value', valorSalvo);
        triggerText.innerText = valorSalvo === 'Todos' ? textoPadrao : valorSalvo;

        let html = `<div class="dropdown-item ${valorSalvo === 'Todos' ? 'selected' : ''}" data-val="Todos">${textoPadrao} (Todos)</div>`;
        lista.forEach(item => {
            html += `<div class="dropdown-item ${valorSalvo === item ? 'selected' : ''}" data-val="${item}">${item}</div>`;
        });
        menu.innerHTML = html;

        // Ao clicar num item da lista
        const items = menu.querySelectorAll('.dropdown-item');
        items.forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = el.getAttribute('data-val');
                container.setAttribute('data-value', val);
                triggerText.innerText = val === 'Todos' ? textoPadrao : val;
                container.classList.remove('active');
                
                items.forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
                
                renderizar(); 
            });
        });
        
        // Ao clicar no botão pílula para abrir
        const trigger = container.querySelector('.dropdown-trigger');
        const novoTrigger = trigger.cloneNode(true);
        trigger.parentNode.replaceChild(novoTrigger, trigger);
        
        novoTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-dropdown').forEach(d => {
                if(d !== container) d.classList.remove('active');
            });
            container.classList.toggle('active');
        });
    };

    const bancos = salsiData.config.bancos || [];
    const categorias = salsiData.config.categorias || [];
    const nomesTerc = [...new Set(salsiData.transacoes.filter(t => t.eDeTerceiro).map(t => t.nomeTerceiro))].filter(Boolean);

    preencherCustom('filtro-cred-banco', bancos, 'Cartões');
    preencherCustom('filtro-cred-cat', categorias, 'Categorias');
    preencherCustom('filtro-deb-cat', categorias, 'Categorias');
    preencherCustom('filtro-terc-banco', bancos, 'Cartões');
    preencherCustom('filtro-terc-nome', nomesTerc, 'Nomes');
    preencherCustom('filtro-deb-forma', ['Débito', 'PIX', 'Dinheiro'], 'Formas');
    preencherCustom('filtro-fixos', ['Pagos', 'Pendentes'], 'Fixos');
}

// Fechar ao clicar fora de qualquer dropdown
window.addEventListener('click', () => {
    document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('active'));
});

window.addEventListener('DOMContentLoaded', preencherFiltrosDropdown);
window.addEventListener('load', injetarAssinatura);

// Função de Login Real
async function fazerLogin() {
    try {
        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-senha').value;
        const loader = document.getElementById('auth-splash-loader'); 
        const form = document.getElementById('login-form');

        if (!email || !senha) {
            alert("Preencha e-mail e senha!");
            return;
        }

        // Esconde o formulário e mostra o loader
        if (form) form.style.display = 'none';
        if (loader) loader.style.display = 'block';

        // Tenta fazer o login no Firebase
        await window.signInWithEmailAndPassword(window.auth, email, senha);
        
        // Se der certo, o Vigia (onAuthStateChanged) vai assumir e esconder a tela!
        
    } catch (error) {
        console.error("Erro no login:", error);
        alert("Erro ao entrar: " + error.message);
        
        // Se der erro (ex: senha errada), ele remove o loader e devolve o formulário
        const loader = document.getElementById('auth-splash-loader'); 
        const form = document.getElementById('login-form');
        if (form) form.style.display = 'block';
        if (loader) loader.style.display = 'none';
    }
}

// Função de Registro Real (Mantenha apenas ESTA versão)
async function fazerCadastro() {
    try {
        const nome = document.getElementById('register-nome').value.trim();
        const email = document.getElementById('register-email').value;
        const senha = document.getElementById('register-senha').value;
        const senhaConf = document.getElementById('register-senha-conf').value;
        
        const loader = document.getElementById('auth-splash-loader'); 
        const form = document.getElementById('register-form');

        if (!nome || !email || !senha || !senhaConf) {
            alert("Preencha todos os campos!");
            return;
        }
        if (senha.length < 6) {
            alert("A senha deve ter pelo menos 6 caracteres.");
            return;
        }
        if (senha !== senhaConf) {
            alert("As senhas não coincidem!");
            return;
        }

        // Esconde o formulário e mostra o loader
        if (form) form.style.display = 'none';
        if (loader) loader.style.display = 'block';

        // Cria a conta e atualiza o nome
        const userCredential = await window.createUserWithEmailAndPassword(window.auth, email, senha);
        await window.updateProfile(userCredential.user, { displayName: nome });
        
    } catch (error) {
        console.error("Erro no cadastro:", error);
        alert("Erro ao cadastrar: " + error.message);
        
        // Se der erro (ex: e-mail já existe), ele remove o loader e devolve o formulário
        const loader = document.getElementById('auth-splash-loader'); 
        const form = document.getElementById('register-form');
        if (form) form.style.display = 'block';
        if (loader) loader.style.display = 'none';
    }
}

// --- O VIGIA (Monitora se o usuário está logado) ---
// Trava de segurança para evitar que o app trave num loop infinito
let isSincronizando = false; 

// Envolvemos o vigia nesta função para ele esperar o Firebase carregar
// Envolvemos o vigia nesta função para ele esperar o Firebase carregar
// Envolvemos o vigia nesta função para ele esperar o Firebase carregar
// Envolvemos o vigia nesta função para ele esperar o Firebase carregar
window.iniciarVigia = function() {
    window.onAuthStateChanged(window.auth, async (user) => {
        const authScreen = document.getElementById('auth-screen');
        
        if (user) {
            // --- USUÁRIO LOGADO ---
            authScreen.style.display = 'none'; 
            
            const splashLoader = document.getElementById('auth-splash-loader');
            if (splashLoader) splashLoader.style.display = 'block';

            atualizarSaudacao(user.displayName || "Visitante");
            
            try {
                // Vai na nuvem buscar os dados
                const uid = user.uid;
                const userDoc = window.doc(window.db, "usuarios", uid);
                const docSnap = await window.getDoc(userDoc);

                if (docSnap.exists() && docSnap.data().dados) {
                    // SE ELE JÁ TEM CONTA
                    salsiData = docSnap.data().dados;
                    
                    // Blindagem: Se for uma conta antiga que não tinha detalhesBancos
                    if (!salsiData.config.detalhesBancos) salsiData.config.detalhesBancos = [];
                    
                    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
                } else {
                    // SE É CONTA NOVA ZERADA: Cria a estrutura inicial perfeita
                    console.log("Usuário novo! Criando estrutura inicial...");
                    salsiData = {
                        config: { 
                            categorias: [
                                "Alimentação", "Assinaturas", "Lazer", "Outros", 
                                "Transporte", "Presentes", "Saúde/Estética", 
                                "Compras", "Mercado", "Fixos", "Terceiros"
                            ], 
                            bancos: ["Cadastre seus cartões!"],
                            detalhesBancos: [
                                { nome: "Cadastre seus cartões!", fechamento: 10, vencimento: 20 }
                            ]
                        },
                        entradas: [], transacoes: [], metas: []
                    };
                    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
                    await window.setDoc(userDoc, { dados: salsiData });
                }

            } catch (error) {
                console.error("Erro ao baixar dados do Firebase:", error);
                alert("Erro de conexão com o servidor. Tente recarregar a página.");
                if (splashLoader) splashLoader.style.display = 'none';
                return; // Interrompe para não carregar a tela pela metade
            }

            // Tudo seguro! Libera a tela
            if (splashLoader) splashLoader.style.display = 'none';
            iniciar(); 
            
        } else {
            // --- SE NÃO TIVER LOGADO --- 
            localStorage.removeItem('salsifin_cache');
            salsiData = { config: { categorias: [], bancos: [], detalhesBancos: [] }, entradas: [], transacoes: [], metas: [] };

            authScreen.style.display = 'flex';
            
            const splashLoader = document.getElementById('auth-splash-loader');
            if (splashLoader) splashLoader.style.display = 'none';
            
            const authLeft = document.querySelector('.auth-left');
            const authRight = document.getElementById('auth-showcase');
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            
            if (window.innerWidth <= 1024) {
                if (authLeft) authLeft.style.display = 'none';
                if (authRight) authRight.style.display = 'flex';
                if (loginForm) loginForm.style.display = 'none';
                if (registerForm) registerForm.style.display = 'none';
            } else {
                if (authLeft) authLeft.style.display = 'flex';
                if (authRight) authRight.style.display = 'flex';
                if (loginForm) loginForm.style.display = 'block';
                if (registerForm) registerForm.style.display = 'none';
            }
            
            iniciarSliderAuth(); 
        }
    });
};

async function salvarNoFirebase() {
    // 1. Sempre salva no PC (pra ficar rápido)
    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));

    // 2. A trava entra em ação aqui: Tem alguém logado de verdade?
    if (!window.auth || !window.auth.currentUser || isSincronizando) {
        return; // Corta a função aqui e proíbe ir pra nuvem!
    }

    const uid = window.auth.currentUser.uid;
    const userDoc = window.doc(window.db, "usuarios", uid);

    // 3. Salva exclusivamente na gaveta do usuário logado
    try {
        await window.setDoc(userDoc, { dados: salsiData });
        console.log("Dados salvos na nuvem com segurança!");
    } catch (e) {
        console.error("Erro ao salvar na nuvem: ", e);
    }
}

// Função para trocar entre Login e Cadastro
function toggleAuth(isRegister) {
    console.log("Trocando tela para registro:", isRegister);
    document.getElementById('login-form').style.display = isRegister ? 'none' : 'block';
    document.getElementById('register-form').style.display = isRegister ? 'block' : 'none';
}

// --- FUNÇÃO DO OLHINHO DA SENHA ---
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fi-rr-eye', 'fi-rr-eye-crossed');
    } else {
        input.type = 'password';
        icon.classList.replace('fi-rr-eye-crossed', 'fi-rr-eye');
    }
}

// --- FUNÇÃO DA SAUDAÇÃO (PC E MOBILE) ATUALIZADA ---
function atualizarSaudacao(nomeCompleto) {
    if (!nomeCompleto) return;
    
    const primeiroNome = nomeCompleto.split(' ')[0];
    const hora = new Date().getHours();
    let saudacaoRandom = "";

    if (hora >= 5 && hora < 12) {
        const opcoes = ["Bom dia", "Ótima manhã", "Eaí"];
        saudacaoRandom = opcoes[Math.floor(Math.random() * opcoes.length)];
    } else if (hora >= 12 && hora < 18) {
        const opcoes = ["Boa tarde", "Eaí", "Olá"];
        saudacaoRandom = opcoes[Math.floor(Math.random() * opcoes.length)];
    } else {
        const opcoes = ["Boa noite", "Eaí", "Olá"];
        saudacaoRandom = opcoes[Math.floor(Math.random() * opcoes.length)];
    }

    // 4. Monta a base da saudação (Texto PC com IA lado a lado - GIGANTE)
    const htmlBasePC = `
        <div class="greeting-title-wrapper" style="display: flex; align-items: center; gap: 20px; white-space: nowrap;">
            <div style="line-height: 1;margin-right: 40px;">
                <span class="greet-light" style="font-size: 35px !important; font-weight: 400; color: var(--text-main); letter-spacing: -0.03em;">${saudacaoRandom},</span> 
                <span class="greet-bold" style="font-size: 35px !important; font-weight: 800; color: var(--dark-green); letter-spacing: -0.04em;">${primeiroNome}!</span>
            </div>
            <div class="ai-trigger desktop-only" onclick="abrirAssistente()" style="display: flex; align-items: center; gap: 8px; padding: 6px 25px; background: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 30px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='rgba(52, 211, 153, 0.2)'" onmouseout="this.style.background='rgba(52, 211, 153, 0.1)'">
                <span style="font-size: 16px;">✨</span>
                <span style="font-weight: 700; color: var(--dark-green); font-size: 13px;">Me pergunte algo...</span>
            </div>
        </div>
    `;

    // 5. Botão BLINDADO para o Mobile com a estrelinha
    const btnIAMobile = `
        <div class="btn-ai-mobile mobile-only" onclick="abrirAssistente()">
            <span class="ai-icon">✨</span>
            <span class="ai-text">Me pergunte algo...</span>
        </div>
    `;

    // 6. Atualiza a DOM
    const containerPC = document.getElementById('greeting-pc');
    if (containerPC) {
        containerPC.innerHTML = htmlBasePC;
        containerPC.style.display = 'block';
    }

    const containerMobile = document.getElementById('greeting-mobile');
    if (containerMobile) {
        containerMobile.innerHTML = `
            <div class="greeting-title-wrapper" style="margin-bottom: 4px;">
                <span class="greet-light" style="font-size: 26px !important;">${saudacaoRandom},</span> 
                <span class="greet-bold" style="font-size: 26px !important;">${primeiroNome}!</span>
            </div>
            ${btnIAMobile}
        `;
    }
}

// --- FUNÇÕES DO PERFIL ---
function abrirModalPerfil() {
    const user = window.auth.currentUser;
    if (user) {
        document.getElementById('perfil-nome').value = user.displayName || '';
        document.getElementById('perfil-email').value = user.email || '';
        document.getElementById('perfil-senha').value = ''; // Sempre limpo por segurança
        
        // 👇 NOVO: Carrega a preferência da IA 👇
        const modoIA = (salsiData.config && salsiData.config.modoIA) ? salsiData.config.modoIA : 'calendario';
        const selectModo = document.getElementById('perfil-modo-ia');
        if (selectModo) selectModo.value = modoIA;

        document.getElementById('modal-perfil').showModal();
        
        // Fecha o menu cascata
        document.getElementById('menu-dropdown').classList.remove('active');
    }
}

async function salvarPerfil() {
    const user = window.auth.currentUser;
    if (!user) return;

    const novoNome = document.getElementById('perfil-nome').value.trim();
    const novoEmail = document.getElementById('perfil-email').value.trim();
    const novaSenha = document.getElementById('perfil-senha').value;
    const btn = document.querySelector('#modal-perfil button');
    
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        let atualizouAlgo = false;

        // 1. Atualiza o nome se foi alterado
        if (novoNome && novoNome !== user.displayName) {
            await window.updateProfile(user, { displayName: novoNome });
            atualizarSaudacao(novoNome); // Atualiza a tela na hora
            atualizouAlgo = true;
        }

        // 2. Atualiza o e-mail se foi alterado
        if (novoEmail && novoEmail !== user.email) {
            await window.updateEmail(user, novoEmail);
            atualizouAlgo = true;
        }

        // 3. Atualiza a senha se ele digitou algo
        if (novaSenha) {
            if (novaSenha.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
            await window.updatePassword(user, novaSenha);
            atualizouAlgo = true;
        }

        // 👇 NOVO: Salva a preferência da IA 👇
        const novoModoIA = document.getElementById('perfil-modo-ia').value;
        if (!salsiData.config) salsiData.config = {};
        if (salsiData.config.modoIA !== novoModoIA) {
            salsiData.config.modoIA = novoModoIA;
            atualizouAlgo = true;
            localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
            if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
        }

        if (atualizouAlgo) {
            alert("Perfil atualizado com sucesso!");
        }
        
        document.getElementById('perfil-senha').value = ''; // Limpa o campo de senha
        document.getElementById('modal-perfil').close();

    } catch (error) {
        console.error("Erro no perfil:", error);
        
        // Trata o erro de segurança do Firebase (Precisa logar de novo para ações sensíveis)
        if (error.code === 'auth/requires-recent-login') {
            alert("🔐 Por segurança, o servidor exige que você tenha feito login recentemente para alterar e-mail ou senha.\n\nPor favor, saia da sua conta, entre novamente e tente fazer a alteração.");
        } else if (error.code === 'auth/email-already-in-use') {
            alert("Este endereço de e-mail já está sendo usado por outra conta.");
        } else if (error.code === 'auth/invalid-email') {
            alert("O formato do e-mail é inválido.");
        } else {
            alert("Erro ao atualizar: " + error.message);
        }
    } finally {
        btn.innerText = "Salvar Alterações";
        btn.disabled = false;
    }
}

// --- FUNÇÃO PARA SAIR DA CONTA COM SEGURANÇA ---
async function sairDaConta() {
    try {
        await window.signOut(window.auth);
        
        // 1. Limpa o cache do navegador
        localStorage.removeItem('salsifin_cache');
        
        // 2. Esvazia a variável da memória
        salsiData = null; 
        
        // 3. Força a página a recarregar limpa (F5)
        location.reload(); 
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
}

// --- FUNÇÃO DO TOAST DE NOTIFICAÇÃO ---
let toastTimeout; // Variável para controlar o tempo

function mostrarToast(mensagem) {
    const toast = document.getElementById('toast-notificacao');
    const toastMsg = document.getElementById('toast-mensagem');

    if (toast && toastMsg) {
        toastMsg.innerText = mensagem; // Define o texto que você enviou
        toast.classList.add('mostrar'); // Faz a notificação subir na tela

        // Limpa o timer anterior (caso o usuário clique várias vezes rápido)
        clearTimeout(toastTimeout);

        // Depois de 3 segundos (3000ms), ele remove a classe e a notificação desce
        toastTimeout = setTimeout(() => {
            toast.classList.remove('mostrar');
        }, 3000); 
    }
}

// --- SISTEMA DA TELA DE BOAS VINDAS E SLIDER ---
let slideInterval;

function iniciarSliderAuth() {
    const container = document.getElementById('slides-container');
    const dots = document.querySelectorAll('.slider-dots .dot');
    if (!container || dots.length === 0) return;

    let indexAtual = 0;
    const totalSlides = dots.length;

    // Atualiza a bolinha ativa se o usuário arrastar com o dedo
    container.addEventListener('scroll', () => {
        const scrollLeft = container.scrollLeft;
        const width = container.offsetWidth;
        indexAtual = Math.round(scrollLeft / width);
        
        dots.forEach(d => d.classList.remove('active'));
        if (dots[indexAtual]) dots[indexAtual].classList.add('active');
    }, { passive: true });

    // Autoplay: muda de slide a cada 4 segundos
    clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        indexAtual = (indexAtual + 1) % totalSlides;
        const width = container.offsetWidth;
        container.scrollTo({ left: width * indexAtual, behavior: 'smooth' });
    }, 4000);
}

// Quando o usuário clica em "Get Started" ou "Sign in" no celular
function mostrarFormulario(tipo) {
    if (window.innerWidth <= 1024) {
        // No celular, esconde o slide e mostra o lado esquerdo (formulários)
        document.getElementById('auth-showcase').style.display = 'none';
        
        const authLeft = document.querySelector('.auth-left');
        if (authLeft) authLeft.style.display = 'flex';
        
        // Para o slider de rodar no fundo para economizar bateria
        clearInterval(slideInterval); 
    }
    
    // Aproveita a sua função nativa que alterna entre Login e Cadastro
    toggleAuth(tipo === 'register'); 
}

function toggleInputsDebito() {
    const isDebito = document.getElementById('banco-apenas-debito').checked;
    const boxDatas = document.getElementById('box-datas-cartao');
    
    // 👇 AQUI ESTAVA O ERRO ANTES! AGORA ESTÃO COM OS IDs CORRETOS 👇
    const inputFechamento = document.getElementById('nc-fechamento');
    const inputVencimento = document.getElementById('nc-vencimento');

    if (isDebito) {
        if (boxDatas) {
            boxDatas.style.opacity = '0.3';
            boxDatas.style.pointerEvents = 'none'; // Impede o clique
        }
        if (inputFechamento) inputFechamento.value = ''; // Limpa se tinha algo
        if (inputVencimento) inputVencimento.value = '';
    } else {
        if (boxDatas) {
            boxDatas.style.opacity = '1';
            boxDatas.style.pointerEvents = 'auto'; // Libera o clique
        }
    }
}

// --- SISTEMA INTELIGENTE DE METAS E LIMITES MENSAIS ---

// Procura qual foi a última meta definida do passado até ao mês atual
function getMetaOrcamento(nome, mesIndex, ano) {
    if (!salsiData.orcamentos) return 0;
    if (!salsiData.orcamentos[nome]) return 0;
    
    // Ex: "2026-02"
    const targetChave = `${ano}-${String(mesIndex + 1).padStart(2, '0')}`;
    const chaves = Object.keys(salsiData.orcamentos[nome]).sort(); // Ordena do mais antigo para o mais novo
    
    let metaAtual = 0;
    for (let chave of chaves) {
        if (chave <= targetChave) {
            metaAtual = salsiData.orcamentos[nome][chave]; // Atualiza com o valor mais recente encontrado
        }
    }
    return metaAtual;
}

// Prepara e abre o modal ao clicar no item
function abrirModalOrcamento(nome) {
    const m = dataFiltro.getMonth();
    const a = dataFiltro.getFullYear();
    const metaAtual = getMetaOrcamento(nome, m, a);
    
    document.getElementById('orc-titulo-display').innerText = `Definir Meta: ${nome}`;
    document.getElementById('orc-nome').value = nome;
    
    const inputVal = document.getElementById('orc-valor');
    // Multiplica por 100 para a função formatarMoeda ler corretamente como centavos
    inputVal.value = metaAtual > 0 ? (metaAtual * 100).toFixed(0) : ''; 
    formatarMoeda(inputVal); 
    
    document.getElementById('modal-orcamento').showModal();
}

// Salva a decisão a partir deste mês em diante
function salvarOrcamento() {
    const nome = document.getElementById('orc-nome').value;
    const meta = parseFloat(document.getElementById('orc-valor').value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    const m = dataFiltro.getMonth();
    const a = dataFiltro.getFullYear();
    const chave = `${a}-${String(m + 1).padStart(2, '0')}`;

    if (!salsiData.orcamentos) salsiData.orcamentos = {};
    if (!salsiData.orcamentos[nome]) salsiData.orcamentos[nome] = {};

    salsiData.orcamentos[nome][chave] = meta;
    
    // Fecha o modal e recarrega a tela para piscar os números
    document.getElementById('modal-orcamento').close();
    renderizar();
}

// --- SISTEMA DE LISTA DE DESEJOS ---

// 1. Desenha a lista na tela
function renderizarDesejos() {
    const container = document.getElementById('lista-desejos-conteudo');
    if (!container) return;

    // Garante que o array existe no banco de dados para não dar erro
    if (!salsiData.desejos) salsiData.desejos = [];

    if (salsiData.desejos.length === 0) {
        container.innerHTML = '<p style="font-size: 13px; color: var(--text-sec); text-align: center; padding: 15px 0; margin: 0;">Nenhum desejo cadastrado. Sonhe alto!</p>';
        return;
    }

    // Monta o visual de cada item
    container.innerHTML = salsiData.desejos.map((d, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px dashed var(--border);">
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <span style="font-weight: 700; font-size: 14px; color: var(--text-main);">${d.nome}</span>
                <span style="font-size: 12px; color: var(--text-sec); font-weight: 600;">R$ ${d.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <button onclick="excluirDesejo(${index})" style="background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; width: 30px; height: 30px; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">×</button>
        </div>
    `).join('');
}

// 2. Abre o Pop-up limpo
function abrirModalDesejo() {
    document.getElementById('d-nome').value = '';
    document.getElementById('d-valor').value = '';
    document.getElementById('modal-desejo').showModal();
}

// 3. Salva o desejo novo
async function salvarDesejo() {
    const nome = document.getElementById('d-nome').value.trim();
    const valorRaw = document.getElementById('d-valor').value;
    const valor = parseFloat(valorRaw.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

    if (!nome || valor <= 0) {
        alert("Preencha o nome e um valor aproximado válido!");
        return;
    }

    if (!salsiData.desejos) salsiData.desejos = [];
    
    salsiData.desejos.push({ nome, valor });
    
    document.getElementById('modal-desejo').close();
    renderizarDesejos();
    
    if (typeof salvarNoFirebase === 'function') await salvarNoFirebase();
    if (typeof mostrarToast === 'function') mostrarToast("Desejo adicionado! 🎯");
}

// 4. Exclui o desejo
async function excluirDesejo(index) {
    if (confirm("Já comprou ou desistiu desse desejo? Posso excluir?")) {
        salsiData.desejos.splice(index, 1);
        renderizarDesejos();
        if (typeof salvarNoFirebase === 'function') await salvarNoFirebase();
    }
}

// --- SISTEMA DE LISTA DE DESEJOS ---

// Função para abrir/fechar usando a SUA animação original do CSS
function toggleDesejos() {
    fecharOutrosPlanejamento('card-desejos-acordeon'); // Força os vizinhos a fecharem
    
    const card = document.getElementById('card-desejos-acordeon');
    const icone = document.getElementById('desejo-toggle-icon');
    
    if (card) {
        card.classList.toggle('expanded');
        
        if (card.classList.contains('expanded')) {
            if(icone) icone.style.transform = 'rotate(0deg)';
        } else {
            if(icone) icone.style.transform = 'rotate(-135deg)';
        }
    }
}

// --- SISTEMA DE SEGURANÇA: SYNC AUTOMÁTICO AO ACORDAR A TELA ---
document.addEventListener('visibilitychange', async () => {
    // Se a aba acabou de ficar visível e o usuário está logado
    if (document.visibilityState === 'visible' && window.auth && window.auth.currentUser) {
        console.log("Aba ativada: Sincronizando com a nuvem para evitar conflitos...");
        
        // Bloqueia salvamentos acidentais enquanto sincroniza
        isSincronizando = true; 

        try {
            const uid = window.auth.currentUser.uid;
            const userDoc = window.doc(window.db, "usuarios", uid);
            const docSnap = await window.getDoc(userDoc);

            if (docSnap.exists() && docSnap.data().dados) {
                // Baixa a versão mais nova da nuvem
                const dadosNuvem = docSnap.data().dados;
                
                // Transforma em texto para comparar se houve mudança
                const cacheLocalText = localStorage.getItem('salsifin_cache');
                const nuvemText = JSON.stringify(dadosNuvem);

                // Só atualiza a tela se a nuvem tiver dados diferentes do PC
                if (cacheLocalText !== nuvemText) {
                    console.log("Mudanças detectadas na nuvem! Atualizando a tela...");
                    salsiData = dadosNuvem;
                    localStorage.setItem('salsifin_cache', nuvemText);
                    
                    // Mostra um aviso rápido e redesenha a tela
                    if (typeof mostrarToast === 'function') {
                        mostrarToast("🔄 Dados sincronizados com sucesso!");
                    }
                    renderizar();
                } else {
                    console.log("Os dados locais já estão iguais aos da nuvem.");
                }
            }
        } catch (error) {
            console.error("Erro ao sincronizar dados ao acordar a aba:", error);
        } finally {
            // Libera o sistema para salvar novamente
            isSincronizando = false;
        }
    }
});

// --- SISTEMA DE INVERSÃO DE ORDEM (MAIS NOVOS / MAIS VELHOS) ---
let ordemMaisNovos = true; // Padrão: mais novos no topo

function alternarOrdem() {
    ordemMaisNovos = !ordemMaisNovos; 
    
    // Gira TODOS os ícones das abas ao mesmo tempo usando a classe
    const icones = document.querySelectorAll('.icone-ordem-rot');
    icones.forEach(icone => {
        icone.style.transform = ordemMaisNovos ? 'rotate(0deg)' : 'rotate(180deg)';
    });
    
    renderizar(); // Manda desenhar a tela toda de novo com a nova ordem!
}

// Arrasta os itens na memória antes de desenhar
function garantirOrdemCronologica() {
    const classificarPorData = (a, b) => {
        const dataA = new Date(a.dataCompra || a.data || 0).getTime();
        const dataB = new Date(b.dataCompra || b.data || 0).getTime();
        return ordemMaisNovos ? (dataB - dataA) : (dataA - dataB);
    };

    if (salsiData.transacoes) salsiData.transacoes.sort(classificarPorData);
    if (salsiData.entradas) salsiData.entradas.sort(classificarPorData);
}

// --- SISTEMA DE ONBOARDING (TUTORIAL) ---
let slideAtualOnb = 1;
const totalSlidesOnb = 5;

function abrirOnboarding() {
    const modal = document.getElementById('modal-onboarding');
    if (modal) {
        slideAtualOnb = 1;
        atualizarVisualOnb();
        modal.showModal();
    }
}

function proximoSlideOnb() {
    if (slideAtualOnb < totalSlidesOnb) {
        slideAtualOnb++;
        atualizarVisualOnb();
    } else {
        fecharOnboarding(); // Se for o último, fecha.
    }
}

function atualizarVisualOnb() {
    for (let i = 1; i <= totalSlidesOnb; i++) {
        const slide = document.getElementById(`onb-slide-${i}`);
        const dot = document.getElementById(`dot-${i}`);
        
        // Coloca ou tira a classe 'active' para ativar a animação em cascata
        if (slide) {
            if (i === slideAtualOnb) {
                slide.classList.add('active');
            } else {
                slide.classList.remove('active');
            }
        }
        
        // Atualiza a bolinha de progresso no topo
        if (dot) dot.classList.toggle('active', i <= slideAtualOnb);
    }
}

function fecharOnboarding() {
    document.getElementById('modal-onboarding').close();
    
    // 👇 NOVO: Salva direto no banco de dados do usuário logado 👇
    if (salsiData && salsiData.config) {
        salsiData.config.tutorialVisto = true;
        
        // Salva localmente e manda pra nuvem do Firebase
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
    }
}

// --- CONTROLO VISUAL DO MODAL DE ENTRADAS ---
function ajustarCamposEntrada() {
    const categoria = document.getElementById('e-categoria').value;
    const divParcelas = document.getElementById('div-entrada-parcelas');
    
    // Só mostra a opção de parcelamento se for um "Projeto / Serviço"
    if (categoria === 'Projetos / Serviços') {
        divParcelas.style.display = 'block';
    } else {
        divParcelas.style.display = 'none';
        document.getElementById('e-parcelas').value = "1"; // Volta logo a 1x para não haver erros de cálculo
    }
}

// --- SISTEMA DE NOTIFICAÇÕES PUSH (CORRIGIDO) ---
async function solicitarPermissaoNotificacao() {
    if (!('Notification' in window)) {
        console.log('Este navegador não suporta notificações.');
        return;
    }

    // Definimos as tuas credenciais aqui para garantir que a função as encontra sempre
    const configLocal = {
        apiKey: "AIzaSyD1HyxzZ-YFMMbMSIwBDDKfNWdCWHb07AY",
        authDomain: "guget-fin.firebaseapp.com",
        projectId: "guget-fin",
        storageBucket: "guget-fin.firebasestorage.app",
        messagingSenderId: "626285959649",
        appId: "1:626285959649:web:9b1006694a4d05fa899aa0"
    };

    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('Permissão concedida! A gerar Token...');
            
            // Importa o Firebase dinamicamente para evitar conflitos de versões
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js");
            const { getMessaging, getToken } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js");

            // Cria uma instância isolada apenas para o Push
            const appPush = initializeApp(configLocal, "push-instance");
            const messaging = getMessaging(appPush);

            // Regista o teu Service Worker (sw.js)
            const swRegistration = await navigator.serviceWorker.register('sw.js');
            
            // Gera o Token com a tua VAPID Key
            const token = await getToken(messaging, { 
                vapidKey: 'BHi1jJ27NXlLSnyE8odTIm5mULqA3NWQGrcOM7d1l1fdSgPKUv8e0_IKccuBVd-UfYYkKPwr-bG15gttuLWVMhg', 
                serviceWorkerRegistration: swRegistration 
            });

            if (token) {
                console.log('SUCESSO! O teu Token de teste apareceu:');
                console.log(token); // <--- COPIA ESTE CÓDIGO DO CONSOLE (F12)
                if (typeof mostrarToast === 'function') mostrarToast("Notificações ativadas! 🔔");
            }
        } else {
            alert("Ativa as notificações nas definições do navegador para receberes os lembretes.");
        }
    } catch (error) {
        console.error('Erro ao configurar notificações:', error);
    }
}

// ==========================================
// MÓDULO DE IMPORTAÇÃO DE EXTRATOS (OFX/CSV) V2
// ==========================================

let dadosImportacaoTemporaria = [];

function processarArquivoExtrato(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const conteudo = e.target.result;
        const extensao = file.name.split('.').pop().toLowerCase();
        
        if (extensao === 'ofx' || extensao === 'ofc') {
            dadosImportacaoTemporaria = parseOFX(conteudo);
        } else if (extensao === 'csv') {
            dadosImportacaoTemporaria = parseCSV(conteudo);
        } else {
            alert("Formato não suportado. Envie OFX ou CSV.");
            return;
        }

        if (dadosImportacaoTemporaria.length > 0) {
            dadosImportacaoTemporaria.sort((a, b) => new Date(a.data) - new Date(b.data));
            renderizarPreviewImportacao();
            document.getElementById('modal-importacao').showModal();
        } else {
            alert("Nenhuma transação válida encontrada no arquivo.");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

// O CÉREBRO: Analisa o nome e decide o que é. 
// (Fique tranquilo: atua APENAS nos gastos do Extrato OFX/CSV!)
function analisarTransacao(nome, valorLido) {
    let nomeUpper = nome.toUpperCase();
    let isSaida = valorLido < 0; 
    let formaPag = "Débito"; // Padrão se o banco não der nenhuma pista

    // 1. Descobre se o dinheiro ENTROU ou SAIU
    const indiciosSaida = ['COMPRA', 'PAGAMENTO', 'PGTO', 'PAGO', 'ENVIO', 'ENVIADO', 'TARIFA', 'MENSALIDADE', 'SAQUE', 'DEBITO', 'DÉBITO', 'IFOOD', 'UBER'];
    const indiciosEntrada = ['RECEBIDO', 'RECEBIMENTO', 'REMUNERACAO', 'SALARIO', 'DEPOSITO', 'RENDIMENTO', 'RESGATE', 'ESTORNO', 'REEMBOLSO'];

    if (!isSaida && valorLido > 0 && indiciosSaida.some(p => nomeUpper.includes(p))) isSaida = true;
    if (isSaida && indiciosEntrada.some(p => nomeUpper.includes(p))) isSaida = false;

    // 2. DETETIVE DE PIX SUPER AFIADO
    // Caça variações que os bancos usam para não escrever "PIX"
    const indiciosPix = ['PIX', 'INSTANTANEO', 'INSTANTÂNEO', 'QR CODE', 'QRCODE', 'CHAVE'];
    const indiciosTransf = ['TED', 'DOC', 'TRANSF', 'TEF', 'TRANSFERENCIA', 'TRANSFERÊNCIA'];

    if (indiciosPix.some(p => nomeUpper.includes(p))) {
        formaPag = "PIX";
    } else if (indiciosTransf.some(p => nomeUpper.includes(p))) {
        formaPag = "Transferência";
    } else if (nomeUpper.includes('BOLETO')) {
        formaPag = "Boleto";
    }

    // 3. MAGIA DA CATEGORIZAÇÃO (Aplica apenas na importação)
    let categoriaSugerida = "Outros"; 

    if (!isSaida) {
        categoriaSugerida = "Renda Extra"; // Padrão para entradas
    } else {
        // O seu dicionário de lojas (Pode incluir mais depois!)
        const regrasCategorias = [
            { cat: "Alimentação", palavras: ["IFOOD", "MCDONALDS", "BURGER KING", "RESTAURANTE", "PADARIA", "PIZZARIA", "LANCHE", "RAPPI", "ZEM", "IFOOD*"] },
            { cat: "Transporte", palavras: ["UBER", "99APP", "99", "POSTO", "GASOLINA", "COMBUSTIVEL", "METRO", "PASSAGEM", "BILHETE", "IPIRANGA", "SHELL", "BUSER", "99 POP"] },
            { cat: "Assinaturas", palavras: ["NETFLIX", "SPOTIFY", "AMAZON PRIME", "DISNEY", "GLOBOPLAY", "APPLE", "GOOGLE", "YOUTUBE", "HBO"] },
            { cat: "Mercado", palavras: ["MERCADO", "ATACADAO", "CARREFOUR", "EXTRA", "GUANABARA", "ASSAI", "SUPERMERCADO", "MUNDIAL", "ZONA SUL"] },
            { cat: "Cuidados Pessoais", palavras: ["FARMACIA", "DROGARIA", "PACHECO", "RAIA", "BARBEARIA", "SALAO", "BELEZA", "CLINICA", "ODONTO"] },
            { cat: "Compras", palavras: ["SHOPEE", "MERCADOLIVRE", "MERCADO LIVRE", "AMAZON", "ALIEXPRESS", "SHEIN", "MAGALU", "RENNER", "C&A", "ZARA"] },
            { cat: "Lazer", palavras: ["CINEMA", "INGRESSO", "SYMPLA", "SHOW", "CINEMARK", "EVENTO"] }
        ];

        for (let regra of regrasCategorias) {
            // Se o nome no extrato tiver a palavra-chave, ele marca a categoria!
            if (regra.palavras.some(p => nomeUpper.includes(p))) {
                categoriaSugerida = regra.cat;
                break; 
            }
        }
    }

    return {
        tipo: isSaida ? 'saida' : 'entrada',
        formaPagamento: formaPag,
        categoria: categoriaSugerida 
    };
}

function parseOFX(ofxString) {
    let transacoes = [];
    const regexTrn = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let match;

    while ((match = regexTrn.exec(ofxString)) !== null) {
        const bloco = match[1];
        const dtPosted = bloco.match(/<DTPOSTED>(\d{8})/)?.[1]; 
        const trnAmt = bloco.match(/<TRNAMT>(.*?)(?:\r|\n|<)/)?.[1];
        let memo = bloco.match(/<MEMO>(.*?)(?:\r|\n|<)/)?.[1] || bloco.match(/<NAME>(.*?)(?:\r|\n|<)/)?.[1] || "Transação Bancária";

        if (dtPosted && trnAmt) {
            const dataFmt = `${dtPosted.substring(0,4)}-${dtPosted.substring(4,6)}-${dtPosted.substring(6,8)}`;
            const valorOriginal = parseFloat(trnAmt);
            const analise = analisarTransacao(memo, valorOriginal);
            
            transacoes.push({
                id: 'imp_' + Math.random().toString(36).substr(2, 9),
                data: dataFmt,
                nome: memo.trim(),
                valor: Math.abs(valorOriginal),
                tipo: analise.tipo,
                formaPagamento: analise.formaPagamento
            });
        }
    }
    return transacoes;
}

function parseCSV(csvString) {
    let transacoes = [];
    const linhas = csvString.split('\n');

    linhas.forEach(linha => {
        if (!linha.trim()) return;

        // 1. Descobre se o banco usou ponto-e-vírgula ou vírgula para separar as colunas
        const delimitador = linha.includes(';') ? ';' : ',';
        
        // 2. Separa as colunas sem quebrar o que está dentro de aspas (ex: "1.000,00")
        const regex = new RegExp(`(?:^|${delimitador})("(?:[^"]|"")*"|[^${delimitador}]*)`, 'g');
        let colunas = [];
        let match;
        while ((match = regex.exec(linha)) !== null) {
            colunas.push(match[1]);
        }

        if (colunas.length < 2) return;

        let dFmt = null, vFmt = null, nFmt = "";

        colunas.forEach(col => {
            if (!col) return;
            // Limpa aspas em volta da palavra/número
            let c = col.replace(/^"|"$/g, '').trim(); 
            if (!c) return;
            
            // Tenta achar a Data
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(c)) {
                let p = c.split('/');
                dFmt = `${p[2]}-${p[1]}-${p[0]}`;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(c)) {
                dFmt = c;
            } 
            // Tenta achar o Valor (agora ele não é mais quebrado ao meio!)
            else if ((/^-?[\d.,]+$/.test(c) || c.includes('R$')) && /[0-9]/.test(c) && !c.includes(':') && !c.includes('/')) {
                let numStr = c.replace(/[R$\s]/g, '');
                
                // Trata o padrão Brasileiro 1.000,00 vs padrão Americano 1,000.00
                if (numStr.includes('.') && numStr.includes(',')) {
                    let ultimoPonto = numStr.lastIndexOf('.');
                    let ultimaVirgula = numStr.lastIndexOf(',');
                    if (ultimaVirgula > ultimoPonto) {
                        numStr = numStr.replace(/\./g, '').replace(',', '.'); // É BR! (1.000,00 -> 1000.00)
                    } else {
                        numStr = numStr.replace(/,/g, ''); // É Americano! (1,000.00 -> 1000.00)
                    }
                } else if (numStr.includes(',')) {
                    numStr = numStr.replace(',', '.'); // Só tem vírgula (100,00 -> 100.00)
                }
                
                let parsed = parseFloat(numStr);
                if (!isNaN(parsed) && vFmt === null) vFmt = parsed;
            } 
            // Tenta achar o NOME (Pega o maior texto da linha)
            else if (/[a-zA-Z]/.test(c) && c.length > 2) {
                if (c.length > nFmt.length) {
                    nFmt = c;
                }
            }
        });

        if (dFmt && vFmt !== null) {
            if (!nFmt) nFmt = "Transferência/Outros"; 
            
            const analise = analisarTransacao(nFmt, vFmt);
            transacoes.push({
                id: 'imp_' + Math.random().toString(36).substr(2, 9),
                data: dFmt,
                nome: nFmt,
                valor: Math.abs(vFmt),
                tipo: analise.tipo,
                formaPagamento: analise.formaPagamento
            });
        }
    });
    return transacoes;
}

function renderizarPreviewImportacao() {
    const container = document.getElementById('lista-importacao-preview');
    container.innerHTML = '';
    
    // 👇 NOVO: Puxa os bancos que você já tem cadastrados no sistema
    const selectBanco = document.getElementById('import-banco-select');
    if (selectBanco && selectBanco.options.length === 0) { // Só preenche se estiver vazio
        salsiData.config.bancos.forEach(banco => {
            selectBanco.innerHTML += `<option value="${banco}">${banco}</option>`;
        });
    }

    let mesAtual = '';

    dadosImportacaoTemporaria.forEach(t => {
        const dataObj = new Date(t.data + 'T12:00:00');
        const mesExtenso = dataObj.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        if (mesExtenso !== mesAtual) {
            mesAtual = mesExtenso;
            container.innerHTML += `<div class="mes-header-importacao">${mesAtual}</div>`;
        }

        const dataCurta = `${dataObj.getDate().toString().padStart(2, '0')}/${(dataObj.getMonth() + 1).toString().padStart(2, '0')}`;
        
        // Etiqueta visual do método de pagamento
        let tagCor = t.formaPagamento === 'PIX' ? '#0ea5e9' : '#8b5cf6'; // Azul pro Pix, Roxo pra Transferência/Débito
        let tagHtml = `<span style="font-size: 9px; background: ${tagCor}; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${t.formaPagamento}</span>`;

        container.innerHTML += `
            <div class="item-importacao ${t.tipo}" id="${t.id}">
                <div style="flex: 1;">
                    <span style="font-size: 11px; color: #a0aec0; font-weight: bold; margin-right: 8px;">${dataCurta}</span>
                    <strong style="color: var(--text-main); font-size: 13px;">${t.nome}</strong> ${tagHtml}
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <strong style="color: ${t.tipo === 'entrada' ? '#10b981' : '#ef4444'}; font-size: 14px;">
                        ${t.tipo === 'entrada' ? '+' : '-'} R$ ${t.valor.toFixed(2)}
                    </strong>
                    <button class="btn-del" title="Remover" onclick="removerItemImportacao('${t.id}')">×</button>
                </div>
            </div>
        `;
    });
}

function removerItemImportacao(id) {
    dadosImportacaoTemporaria = dadosImportacaoTemporaria.filter(t => t.id !== id);
    const itemEl = document.getElementById(id);
    if(itemEl) itemEl.remove(); // Remove visualmente sem ter que redesenhar toda a tela
}

function confirmarImportacao() {
    const selectBanco = document.getElementById('import-banco-select');
    const bancoEscolhido = selectBanco ? selectBanco.value : 'Nubank';

    dadosImportacaoTemporaria.forEach(t => {
        if (t.tipo === 'saida') {
            
            // 👇 A CORREÇÃO ESTÁ AQUI: Força o tipo base para 'debito' para não sumir da tela
            let tipoFinal = 'debito';

            salsiData.transacoes.push({
                nome: t.nome,
                valorTotal: t.valor,        
                valorParcela: t.valor,      
                dataCompra: t.data,
                tipo: tipoFinal,            // Agora o sistema vai enxergar!
                banco: bancoEscolhido,      
                categoria: "Outros",
                formaPagamento: t.formaPagamento,
                pago: true,                 
                parcelas: 1,
                delayPagamento: 0,
                eDeTerceiro: false,
                nomeTerceiro: ""
            });
        } else if (t.tipo === 'entrada') {
            const partes = t.data.split('-');
            const anoImportado = parseInt(partes[0]);
            const mesImportado = parseInt(partes[1]) - 1; 
            
            salsiData.entradas.push({
                nome: t.nome,               // 👈 AGORA USA O NOME REAL DO EXTRATO (Ex: Pix de João)
                cliente: "Via Extrato",     // 👈 Deixa apenas um aviso no cliente
                valor: t.valor,
                dataRecebimento: t.data,
                mes: mesImportado,          
                ano: anoImportado,
                categoria: "Renda Extra"
            });
        }
    });

    document.getElementById('modal-importacao').close();
    
    // Salva no Firebase e recalcula a tela com a estrutura perfeita
    if (typeof salvarDados === 'function') salvarDados();
    if (typeof renderizar === 'function') renderizar();
    
    if (typeof mostrarToast === 'function') {
        mostrarToast(`${dadosImportacaoTemporaria.length} itens importados com sucesso! 🚀`);
    } else {
        alert("Importação concluída com sucesso!");
    }
    
    // Esvazia a memória do pop-up
    dadosImportacaoTemporaria = []; 
}

// --- FUNÇÃO PARA RECUPERAR SENHA ---
async function recuperarSenha() {
    const email = document.getElementById('login-email').value.trim();
    
    if (!email) {
        alert("Por favor, digite seu e-mail no campo acima para receber o link de recuperação.");
        document.getElementById('login-email').focus();
        return;
    }

    try {
        await window.sendPasswordResetEmail(window.auth, email);
        alert(`E-mail de redefinição enviado para ${email}!\n\nVerifique sua caixa de entrada e também a pasta de Spam.`);
    } catch (error) {
        console.error("Erro ao enviar recuperação:", error);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
            alert("Não encontramos nenhuma conta com este e-mail.");
        } else {
            alert("Erro ao tentar recuperar a senha: " + error.message);
        }
    }
}

// ==========================================
// MÓDULO: MODO NOTURNO (DARK THEME)
// ==========================================

function toggleTema() {
    const isDark = document.getElementById('theme-toggle').checked;
    
    if (isDark) {
        document.body.classList.add('dark-theme');
        localStorage.setItem('guget_theme', 'dark'); 
    } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('guget_theme', 'light');
    }

    // Atualiza o gráfico anual e os gráficos de metas para as cores ajustarem
    setTimeout(() => {
        if (typeof atualizarGraficoAnual === 'function') atualizarGraficoAnual();
        if (typeof atualizarGraficoMeta === 'function') atualizarGraficoMeta();
    }, 100);
}

function carregarTemaPreferido() {
    const temaSalvo = localStorage.getItem('guget_theme');
    const toggleEl = document.getElementById('theme-toggle');

    if (temaSalvo === 'dark') {
        document.body.classList.add('dark-theme');
        if (toggleEl) toggleEl.checked = true; 
    } else {
        document.body.classList.remove('dark-theme');
        if (toggleEl) toggleEl.checked = false;
    }
}

// ==========================================
// MÓDULO: CARREGAMENTO AUTOMÁTICO DO TEMA
// ==========================================

function carregarTemaPreferido() {
    // 1. Lê a memória do navegador
    const temaSalvo = localStorage.getItem('guget_theme');
    const toggleEl = document.getElementById('theme-toggle');

    // 2. Aplica a cor correta e ajusta o interruptor no modal de perfil
    if (temaSalvo === 'dark') {
        document.body.classList.add('dark-theme');
        if (toggleEl) toggleEl.checked = true; 
    } else {
        document.body.classList.remove('dark-theme');
        if (toggleEl) toggleEl.checked = false;
    }
}

// 3. GATILHO AUTOMÁTICO: Roda a função assim que o HTML da página termina de carregar
document.addEventListener('DOMContentLoaded', carregarTemaPreferido);

// 4. GATILHO EXTRA: Garante que rode imediatamente se a página já estiver montada
carregarTemaPreferido();

// ==========================================
// MÓDULO: ASSISTENTE VIRTUAL (NANO BANANA)
// ==========================================

function abrirAssistente() {
    const chat = document.getElementById('chat-messages');
    
    // Zera o chat e dá as boas vindas sempre que abrir
    chat.innerHTML = `
        <div style="align-self: flex-start; background: var(--sidebar-bg); padding: 12px 16px; border-radius: 12px 12px 12px 0; border: 1px solid var(--border); max-width: 85%; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 13px; color: var(--text-main); line-height: 1.5;">Au au! Olá! Eu sou a <strong>Guget</strong> <img src="https://cdn-icons-png.flaticon.com/512/10118/10118932.png" style="width: 16px; vertical-align: middle; margin-bottom: 2px;">.<br>Posso analisar os seus dados em tempo real. Escolha uma das opções abaixo ou digite a sua pergunta!</p>
        </div>
    `;
    
    document.getElementById('modal-assistente').showModal();
}

// Nova função para os botões de atalho
function enviarPerguntaPronta(texto) {
    const input = document.getElementById('chat-input');
    input.value = texto;
    enviarMensagemAssistente();
}

function enviarMensagemAssistente() {
    const input = document.getElementById('chat-input');
    const texto = input.value.trim();
    if(!texto) return;

    const chat = document.getElementById('chat-messages');

    // Plota a mensagem do Usuário
    chat.innerHTML += `
        <div style="align-self: flex-end; background: var(--dark-green); color: white; padding: 10px 15px; border-radius: 12px 12px 0 12px; max-width: 80%;">
            <p style="margin: 0; font-size: 13px; font-weight: 600;">${texto}</p>
        </div>
    `;
    
    input.value = '';
    chat.scrollTop = chat.scrollHeight;

    // Simula o "Digitando..." da cachorrinha
    const typingId = 'typing-' + Date.now();
    chat.innerHTML += `
        <div id="${typingId}" style="align-self: flex-start; background: var(--sidebar-bg); padding: 10px 15px; border-radius: 12px 12px 12px 0; border: 1px solid var(--border); max-width: 80%; margin-top: 5px;">
            <p style="margin: 0; font-size: 12px; color: var(--text-sec); font-style: italic;">Guget está farejando seus dados...</p>
        </div>
    `;
    chat.scrollTop = chat.scrollHeight;

    setTimeout(() => {
        document.getElementById(typingId).remove();
        gerarRespostaAssistente(texto, chat);
    }, 1200);
}

function gerarRespostaAssistente(pergunta, chat) {
    let resposta = "";
    const p = pergunta.toLowerCase();
    
    const m = dataFiltro.getMonth();
    const a = dataFiltro.getFullYear();

    // SETUP DE VIAGEM NO TEMPO
    let prevM = m - 1, prevA = a;
    if (prevM < 0) { prevM = 11; prevA--; }
    
    let nextM = m + 1, nextA = a;
    if (nextM > 11) { nextM = 0; nextA++; }

    // VARIÁVEIS DE CÁLCULO
    let totalGastos = 0, totalEntradas = 0, faturasCartao = 0;
    let gastosPassado = 0, gastosPassadoAteHoje = 0; // NOVA LÓGICA DE RITMO
    let faturaFutura = 0, fixosFuturos = 0;
    let tagSum = {};
    let nomesSum = {}; 
    const diaAtualHoje = new Date().getDate(); // Lê o dia exato de hoje

    // Recolhe entradas do mês atual
    salsiData.entradas.forEach(e => {
        if (e.mes === m && e.ano === a) totalEntradas += e.valor;
    });

    // VARREDURA TEMPORAL DE GASTOS
    salsiData.transacoes.forEach(t => {
        if (t.eDeTerceiro) return; 

        const d = new Date(t.dataCompra + "T00:00:00");
        let mesRef = d.getMonth() + (t.delayPagamento || 0);
        let anoRef = d.getFullYear();
        if (mesRef > 11) { mesRef -= 12; anoRef++; }
        
        const diffAtual = (a - anoRef) * 12 + (m - mesRef);
        const diffPassado = (prevA - anoRef) * 12 + (prevM - mesRef);
        const diffFuturo = (nextA - anoRef) * 12 + (nextM - mesRef);

        const val = t.tipo === 'cartao' ? t.valorParcela : t.valorTotal;
        const bancoCredito = t.tipo === 'cartao' || (t.tipo === 'fixo' && t.banco && !(salsiData.config.detalhesBancos?.find(d => d.nome === t.banco)?.isDebitoOnly || t.banco.toLowerCase().includes('débito')));

        // 1. DADOS DO MÊS ATUAL
        if (diffAtual >= 0 && diffAtual < t.parcelas) {
            if (bancoCredito) faturasCartao += val;
            if (t.tipo !== 'fixo' || t.pago) {
                totalGastos += val;
                tagSum[t.categoria] = (tagSum[t.categoria] || 0) + val;
                
                let nomeLimpo = t.nome.toUpperCase().trim().split(' ')[0]; 
                if(nomeLimpo.length > 2) nomesSum[nomeLimpo] = (nomesSum[nomeLimpo] || 0) + val;
            }
        }

        // 2. DADOS DO MÊS PASSADO
        if (diffPassado >= 0 && diffPassado < t.parcelas) {
            if (t.tipo !== 'fixo' || t.pago) {
                gastosPassado += val; // Soma do mês passado INTEIRO
                
                // 👇 CÁLCULO DE RITMO: Soma apenas o que foi comprado ATÉ o dia de hoje no mês passado
                if (d.getDate() <= diaAtualHoje) {
                    gastosPassadoAteHoje += val;
                }
            }
        }

        // 3. DADOS DO FUTURO (Próximo mês)
        if (diffFuturo >= 0 && diffFuturo < t.parcelas) {
            if (bancoCredito) faturaFutura += val;
            if (t.tipo === 'fixo') fixosFuturos += val;
        }
    });

    // 🧠 LÓGICA 1: Onde gasto mais?
    if (p.includes("gasto") || p.includes("categoria") || p.includes("onde") || p.includes("maior")) {
        const catOrdenadas = Object.entries(tagSum).sort((x, y) => y[1] - x[1]);
        if (catOrdenadas.length > 0) {
            resposta = `O seu maior foco de despesas este mês é com <strong>${catOrdenadas[0][0]}</strong>, totalizando R$ ${catOrdenadas[0][1].toFixed(2)}.<br><br>`;
            if(catOrdenadas.length > 1) resposta += `Em seguida vem <strong>${catOrdenadas[1][0]}</strong> (R$ ${catOrdenadas[1][1].toFixed(2)}). `;
        } else {
            resposta = "Você ainda não tem gastos registrados para este mês! O seu bolso agradece. 💸";
        }
    } 
    // 🧠 LÓGICA 2: Resumo do Mês
    else if (p.includes("resumo") || p.includes("balanço") || p.includes("saldo") || p.includes("atual")) {
        let saldo = totalEntradas - totalGastos;
        resposta = `Panorama do mês atual:<br><br>🟢 <strong>Entradas:</strong> R$ ${totalEntradas.toFixed(2)}<br>🔴 <strong>Saídas:</strong> R$ ${totalGastos.toFixed(2)}<br><br>`;
        if (saldo > 0) resposta += `Seu saldo está positivo em <strong>R$ ${saldo.toFixed(2)}</strong>! Excelente trabalho.`;
        else if (saldo < 0) resposta += `Atenção: Seu saldo está negativo em <strong>R$ ${Math.abs(saldo).toFixed(2)}</strong>.`;
        else resposta += `Você está exatamente no limite (R$ 0,00).`;
    }
    // 🧠 LÓGICA 3: Faturas Atuais
    else if (p.includes("fatura") && !p.includes("futuro") && !p.includes("próximo")) {
        if (faturasCartao > 0) resposta = `A soma de todas as suas faturas de crédito (incluindo fixos) está em <strong>R$ ${faturasCartao.toFixed(2)}</strong> este mês.`;
        else resposta = `Ótimas notícias! Nenhuma fatura de crédito para pagar este mês.`;
    }
    // 🧠 LÓGICA 4: Comparação Passado vs Presente (TOTALMENTE REFORMULADA)
    else if (p.includes("comparar") || p.includes("passado") || p.includes("anterior")) {
        const hoje = new Date();
        const modoIA = salsiData.config?.modoIA || 'calendario';
        
        let mesAlvo = hoje.getMonth();
        let anoAlvo = hoje.getFullYear();
        
        // Se o usuário foca no vencimento, o "mês atual" dele é sempre o mês que vem!
        if (modoIA === 'fatura') {
            mesAlvo += 1;
            if (mesAlvo > 11) {
                mesAlvo = 0;
                anoAlvo += 1;
            }
        }

        // A IA agora sabe exatamente qual mês o usuário considera como o "Atual"
        const isMesAtual = (m === mesAlvo && a === anoAlvo);

        // Se o usuário estiver a analisar o mês corrente, usamos a inteligência do dia a dia
        if (isMesAtual) {
            let diferencaPeriodo = totalGastos - gastosPassadoAteHoje;
            
            resposta = `Analisando o seu ritmo de gastos... 🕵️‍♂️<br><br>`;
            resposta += `Neste exato dia no mês passado (dia ${diaAtualHoje}), você já havia gastado <strong>R$ ${gastosPassadoAteHoje.toFixed(2)}</strong>.<br><em>(No fim desse mês, o total foi de R$ ${gastosPassado.toFixed(2)}).</em><br><br>`;
            resposta += `Até agora, neste mês, você gastou <strong>R$ ${totalGastos.toFixed(2)}</strong>.<br><br>`;

            if (diferencaPeriodo > 0) {
                resposta += `🚨 <strong>ALERTA:</strong> Você gastou <strong>R$ ${diferencaPeriodo.toFixed(2)} a mais</strong> do que nesse mesmo período do mês anterior!<br><br>`;
                resposta += `💡 <strongDica da Guget:</strong> `;
                
                if (totalGastos >= gastosPassado) {
                    resposta += `Você já bateu o recorde do mês passado inteiro e o mês nem acabou! Pise no freio agora mesmo. Esconda os cartões e congele compras não essenciais.`;
                } else {
                    resposta += `Seu ritmo de gastos está agressivo. Se continuar assim, sua fatura vai estourar. Tente segurar os pedidos de comida e as compras por impulso nesta reta final.`;
                }
            } else if (diferencaPeriodo < 0) {
                resposta += `🌟 <strong>EXCELENTE!</strong> Você gastou <strong>R$ ${Math.abs(diferencaPeriodo).toFixed(2)} a menos</strong> do que nesse mesmo período do mês passado!<br><br>`;
                resposta += `💡 <strong>Dica da nano banana:</strong> Seu ritmo de economia está perfeito. Mantenha o controle, não caia na armadilha do "já que sobrou, vou comprar", e foque em direcionar este saldo para as suas Metas!`;
            } else {
                resposta += `⚖️ Você está gastando rigorosamente a mesma quantia. Consistência é bom, mas vamos tentar fechar o mês economizando um pouco mais?`;
            }
            
        } else {
            // Se ele estiver a ver o histórico de um mês já fechado (ex: ver Dezembro)
            let diferenca = totalGastos - gastosPassado;
            resposta = `No mês anterior a este, você gastou um total de <strong>R$ ${gastosPassado.toFixed(2)}</strong>.<br><br>`;
            
            if (diferenca > 0) {
                resposta += `📈 Neste mês selecionado, você gastou <strong>R$ ${diferenca.toFixed(2)} a mais</strong> do que no anterior.`;
            } else if (diferenca < 0) {
                resposta += `📉 Você economizou <strong>R$ ${Math.abs(diferenca).toFixed(2)}</strong> em comparação ao mês anterior.`;
            } else {
                resposta += `Seus gastos foram exatamente iguais.`;
            }
        }
    }
    // 🧠 LÓGICA 5: Previsão do Próximo Mês
    else if (p.includes("previsão") || p.includes("próximo") || p.includes("futuro")) {
        let despesaGarantida = faturaFutura + fixosFuturos; 
        resposta = `🔮 Olhando para o futuro (próximo mês), você já tem <strong>R$ ${despesaGarantida.toFixed(2)}</strong> comprometidos.<br><br>`;
        resposta += `Deste valor:<br>💳 <strong>R$ ${faturaFutura.toFixed(2)}</strong> são de faturas de cartão (parcelas e fixos).<br>📌 <strong>R$ ${fixosFuturos.toFixed(2)}</strong> são de contas fixas.<br><br>`;
        
        if (despesaGarantida > totalEntradas && totalEntradas > 0) {
            resposta += `⚠️ <strong>ALERTA:</strong> Suas dívidas do próximo mês já ultrapassam a sua renda média atual. Freie os parcelamentos!`;
        } else {
            resposta += `Isso significa que você começará o próximo mês já devendo esse valor. Planeje-se!`;
        }
    }
    // 🧠 LÓGICA 6: Vícios e Hábitos 
    else if (p.includes("vício") || p.includes("hábito") || p.includes("específico") || p.includes("ifood") || p.includes("uber")) {
        const nomesOrdenados = Object.entries(nomesSum).sort((x, y) => y[1] - x[1]);
        if (nomesOrdenados.length > 0) {
            resposta = `🕵️ Analisei os nomes dos seus gastos. Seus maiores "ralos" de dinheiro específicos neste mês são:<br><br>`;
            resposta += `🍔 <strong>${nomesOrdenados[0][0]}</strong>: R$ ${nomesOrdenados[0][1].toFixed(2)}<br>`;
            if (nomesOrdenados.length > 1) resposta += `🛍️ <strong>${nomesOrdenados[1][0]}</strong>: R$ ${nomesOrdenados[1][1].toFixed(2)}<br>`;
            if (nomesOrdenados.length > 2) resposta += `💸 <strong>${nomesOrdenados[2][0]}</strong>: R$ ${nomesOrdenados[2][1].toFixed(2)}<br><br>`;
            resposta += `Esses pequenos (ou grandes) gastos frequentes são os que mais corroem o saldo. Fique de olho!`;
        } else {
            resposta = `Não consegui identificar repetições significativas de nomes neste mês.`;
        }
    }
    // 🧠 LÓGICA 7: Resposta padrão
    else {
        resposta = `Como sou uma IA focada nas suas finanças, sou melhor analisando números! Tente usar os botões acima ou perguntar algo como <strong>"Previsão do próximo mês"</strong> ou <strong>"Comparar com o mês passado"</strong>.`;
    }

    // Plota a resposta na tela com animação de entrada
    chat.innerHTML += `
        <div style="align-self: flex-start; background: var(--sidebar-bg); padding: 12px 16px; border-radius: 12px 12px 12px 0; border: 1px solid var(--border); max-width: 85%; margin-top: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); animation: fadeIn 0.3s ease;">
            <p style="margin: 0; font-size: 13px; color: var(--text-main); line-height: 1.5;">${resposta}</p>
        </div>
    `;
    chat.scrollTop = chat.scrollHeight;
}

// Abre/Fecha a central de Faturas no PC
function toggleNotificacoesPC(event) {
    event.stopPropagation();
    document.getElementById('dropdown-notificacoes').classList.toggle('active');
}

// Atualiza o click global para fechar essa janelinha também
document.addEventListener('click', function(event) {
    // ... os outros menus ...
    const notifDrop = document.getElementById('dropdown-notificacoes');
    const notifCont = document.getElementById('container-notificacoes-pc');
    if (notifDrop && notifDrop.classList.contains('active') && notifCont && !notifCont.contains(event.target)) {
        notifDrop.classList.remove('active');
    }
});

function injetarAssinatura() {
    const segredo = "YXBwIHdlYiBjcmlhZG8gcG9yIDxhIGhyZWY9Imh0dHA6Ly93d3cubmljb2xhc25ldmVzLmNvbS5iciIgdGFyZ2V0PSJfYmxhbmsiPk7DrWNvbGFzIE5ldmVzPC9hPg==";
    
    const realizarInjecao = () => {
        const conteudo = decodeURIComponent(escape(atob(segredo)));

        // 1. Versão PC: Sidebar (Abaixo das opções)
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && !document.querySelector('.pc-sig')) {
            const elPC = document.createElement('div');
            elPC.className = 'dev-signature pc-sig';
            elPC.innerHTML = conteudo;
            sidebar.appendChild(elPC);
        }

        // 2. Versão Mobile: Apenas na Aba de Planejamento
        const abaPlan = document.getElementById('aba-planejamento');
        if (abaPlan && !document.querySelector('.mobile-sig')) {
            const elMob = document.createElement('div');
            elMob.className = 'dev-signature mobile-sig mobile-only';
            elMob.innerHTML = conteudo;
            abaPlan.appendChild(elMob);
        }
    };

    realizarInjecao();
    // Reforço caso o carregamento demore
    setTimeout(realizarInjecao, 500);
}

// Chame a função no final do seu app.js
injetarAssinatura();
