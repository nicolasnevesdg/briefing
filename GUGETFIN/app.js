let salsiData = JSON.parse(localStorage.getItem('salsifin_cache')) || { config: { categorias: [], bancos: [] }, entradas: [], transacoes: [], metas: [] };
let subAbaCartaoAtiva = 'credito';
let dataFiltro = new Date();
dataFiltro.setDate(1);  

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

function iniciar() { popularSelects(); renderizar(); verificarLembreteBackup(); }

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
    // ---------------------------------------------

    // 1. Entradas (Sidebar + Aba Mobile)
    const entMes = salsiData.entradas.filter(e => e.mes === m && e.ano === a);
    const totalEnt = entMes.reduce((acc, curr) => acc + curr.valor, 0);

    // RENDER PC (Sidebar)
    document.getElementById('lista-entradas').innerHTML = entMes.map(e => `
        <div class="sidebar-list-item">
            <span>${e.nome}</span>
            <div class="sidebar-value">
                R$ ${e.valor.toFixed(2)}
                <button class="btn-del" onclick="excluirEntrada(${salsiData.entradas.indexOf(e)})">×</button>
            </div>
        </div>`).join('');

    // RENDER MOBILE (Aba dedicada)
    const listaMob = document.getElementById('lista-entradas-mobile');
    if (listaMob) {
        listaMob.innerHTML = entMes.map(e => `
            <div class="entrada-item-mobile">
                <div class="ent-info">
                    <strong>${e.nome}</strong>
                    <span>Recebido</span>
                </div>
                <div class="ent-valor-box">
                    <span class="ent-valor">+ R$ ${e.valor.toFixed(2)}</span>
                    <button class="btn-del" onclick="excluirEntrada(${salsiData.entradas.indexOf(e)})" style="margin-left:10px">×</button>
                </div>
            </div>
        `).join('') || '<p style="text-align:center; padding:20px; color:var(--text-sec)">Nenhuma entrada.</p>';
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

                totalTerceirosMes += val; // SOMA CORRETA AQUI
                temGastoTerceiro = true;

                const tagTipoPC = t.tipo === 'cartao' 
                    ? `<span class="badge" style="background:${getCor(t.banco)}">${t.banco}</span>`
                    : `<span class="badge-tag">DÉBITO</span>`;

                if(tTable) {
                    tTable.innerHTML += `
                        <tr class="desktop-only-row">
                            <td style="cursor: pointer; font-weight: 500;" onclick="verDetalhes(${idx})">${t.nome}</td>
                            <td><span class="badge-tag">${t.nomeTerceiro}</span></td>
                            <td style="text-align: center;">${tagTipoPC}</td>
                            <td style="text-align: center;">${diff + 1}/${t.parcelas}</td>
                            <td style="text-align: right; font-weight: 600;">R$ ${val.toFixed(2)}</td>
                            <td><button class="btn-del" onclick="excluirGasto(${idx})">×</button></td>
                        </tr>`;
                }

                if (mTerceiros) {
                    mTerceiros.innerHTML += `
                        <div class="cartao-item-mobile" onclick="verDetalhes(${idx})" style="cursor: pointer;">
                            <div class="cartao-info-principal">
                                <div class="cartao-nome-grupo">
                                    <strong>${t.nome}</strong>
                                    <span class="cartao-parcela-tag">${diff + 1}/${t.parcelas}</span>
                                </div>
                                <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
                                    <span class="badge" style="background:${getCor(t.banco)}">${t.banco}</span>
                                    <span class="badge-tag" style="background: #f0f2f1; color: #7a8b87; font-size: 11px; padding: 2px 6px;">
                                        ${t.nomeTerceiro}
                                    </span>
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
                if (t.tipo !== 'fixo' || (t.tipo === 'fixo' && t.pago === true)) {
                    totalGastoMes += val;
                    tagSum[t.categoria] = (tagSum[t.categoria] || 0) + val;
                }

                if (t.tipo === 'fixo') {
                    if (t.pago === true) totalFixoMes += val;
                    
                    const estiloPC = t.pago ? '' : 'style="opacity: 0.5; font-style: italic;"';
                    if(fTable) {
                        fTable.innerHTML += `
                            <tr ${estiloPC} class="desktop-only-row">
                                <td style="cursor: pointer; font-weight: 500;" onclick="verDetalhes(${idx})">${t.nome}</td>
                                <td>R$ ${val.toFixed(2)}</td>
                                <td style="text-align: center;"><input type="checkbox" ${t.pago ? 'checked' : ''} onchange="alternarStatusPago(${idx})"></td>
                                <td><button class="btn-del" onclick="excluirGasto(${idx})">×</button></td>
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
    
    // Renderiza Lembretes (Mantido o código original)
    const containerLembretes = document.getElementById('container-lembretes-fatura');
    if (containerLembretes) {
        containerLembretes.innerHTML = ''; 
        salsiData.config.detalhesBancos?.forEach(ban => {
            const valorFatura = bankSum[ban.nome] || 0;
            if (valorFatura > 0) {
                const hoje = new Date().getDate();
                const vencimento = parseInt(ban.vencimento);
                const diasFaltando = vencimento - hoje;
                
                let bgCor = '#f8faf9', borderCor = '#e2e8f0', statusTexto = `Vence dia ${vencimento}`;
                if (diasFaltando <= 3 && diasFaltando >= 0) { bgCor = '#fff5f5'; borderCor = '#feb2b2'; statusTexto = `⚠️ Vence dia ${vencimento}!`; }

                containerLembretes.innerHTML += `
                    <div style="background: ${bgCor}; border: 1px solid ${borderCor}; padding: 10px 15px; border-radius: 12px; min-width: 140px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${getCor(ban.nome)}"></div>
                            <span style="font-size: 11px; font-weight: 700; color: #4a5568; text-transform: uppercase;">${ban.nome}</span>
                        </div>
                        <div style="font-size: 14px; font-weight: 800; color: #1a202c;">R$ ${valorFatura.toFixed(2)}</div>
                        <div style="font-size: 10px; color: #718096; font-weight: 500;">${statusTexto}</div>
                    </div>`;
            }
        });
    }

    // Renderiza Categorias (Tags)
    const htmlTags = Object.entries(tagSum).map(([k,v]) => renderLinhaOrcamento(k, v, false)).join('');
    const temTags = salsiData.config.categorias && salsiData.config.categorias.length > 0;
    const tagListaEl = document.getElementById('resumo-tags-lista');
    if (tagListaEl) tagListaEl.innerHTML = htmlTags || (temTags ? '<p style="padding:15px 0; color:#a0aec0; font-size: 13px;">Nenhum gasto.</p>' : '<p style="padding:15px 0; color:#a0aec0; font-size: 13px;">Você ainda não cadastrou categorias.</p>');
    
    // Renderiza Entradas!
    const resEntEl = document.getElementById('resumo-entradas-lista');
    if (resEntEl) resEntEl.innerHTML = renderLinhaOrcamento('Total Recebido', totalEnt, true);
    
    // 6. CÁLCULO ANUAL
    let anEnt = 0, anCred = 0, anDeb = 0, anFixo = 0;
    salsiData.entradas.forEach(e => { if(e.ano === a) anEnt += e.valor; });
    
    for (let mesIdx = 0; mesIdx < 12; mesIdx++) {
        salsiData.transacoes.forEach(t => {
            const d = new Date(t.dataCompra + "T00:00:00");
            const infoB = salsiData.config.detalhesBancos?.find(b => b.nome === t.banco);
            const f = infoB ? parseInt(infoB.fechamento) : 1;
            let mr = d.getMonth(); 
            if (d.getDate() >= f) mr += 1;
            const df = (a - d.getFullYear()) * 12 + (mesIdx - mr);

            if (df >= 0 && df < t.parcelas && !t.eDeTerceiro) {
                const v = t.tipo === 'cartao' ? t.valorParcela : t.valorTotal;
                if (t.tipo !== 'fixo' || (t.tipo === 'fixo' && t.pago === true)) {
                    if (t.tipo === 'cartao') anCred += v; 
                    else if (t.tipo === 'debito') anDeb += v; 
                    else anFixo += v;
                }
            }
        });
    }

    const eAnnEntradas = document.getElementById('ann-entradas');
    if(eAnnEntradas) {
        eAnnEntradas.innerText = `R$ ${anEnt.toFixed(2)}`;
        document.getElementById('ann-saidas').innerText = `R$ ${(anCred + anDeb + anFixo).toFixed(2)}`;
        document.getElementById('ann-credito').innerText = `R$ ${anCred.toFixed(2)}`;
        document.getElementById('ann-debito').innerText = `R$ ${anDeb.toFixed(2)}`;
    }

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
        mostrarToast("Lançamento atualizado com sucesso! ✏️");
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

function abrirModalConfig() {
    document.getElementById('conf-bancos').value = salsiData.config.bancos.join(', ');
    document.getElementById('conf-categorias').value = salsiData.config.categorias.join(', ');
    document.getElementById('modal-config').showModal();
}

function toggleOpcoes() { document.getElementById('menu-opcoes').classList.toggle('active'); }
function confirmarEntrada() { salsiData.entradas.push({ nome: document.getElementById('e-nome').value, valor: parseFloat(document.getElementById('e-valor').value), mes: dataFiltro.getMonth(), ano: dataFiltro.getFullYear() }); renderizar(); document.getElementById('modal-entrada').close(); mostrarToast("Receita adicionada! 💰");}
function salvarConfig() {
    const bancosRaw = document.getElementById('conf-bancos').value.split(',');
    salsiData.config.detalhesBancos = bancosRaw.map(b => {
        const [nome, fechamento] = b.split(':');
        return { nome: nome.trim(), fechamento: fechamento ? parseInt(fechamento.trim()) : 1 };
    });
    salsiData.config.bancos = salsiData.config.detalhesBancos.map(b => b.nome);
    salsiData.config.categorias = document.getElementById('conf-categorias').value.split(',').map(s => s.trim());
    popularSelects(); renderizar(); document.getElementById('modal-config').close();
}

function excluirGasto(idx) { if(confirm("Apagar?")) { salsiData.transacoes.splice(idx,1); renderizar(); } }
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
    document.getElementById('modal-detalhes').close(); // Fecha o modal de detalhes
    
    const t = salsiData.transacoes[index];
    if (!t) return;

    popularSelects();

    // Muda a cara do modal para Modo Edição
    const titulo = document.getElementById('modal-titulo');
    if (titulo) titulo.innerText = 'Editar Gasto ✏️';
    
    // Salva o index na memória invisível
    const indexEdit = document.getElementById('g-index-edit');
    if (indexEdit) indexEdit.value = index;

    // Preenche todos os campos com as propriedades exatas do seu banco
    document.getElementById('g-nome').value = t.nome || '';
    
    const inputValor = document.getElementById('g-valor');
    inputValor.value = t.valorTotal ? (t.valorTotal * 100).toFixed(0) : '';
    formatarMoeda(inputValor);

    document.getElementById('g-data').value = t.dataCompra || '';
    document.getElementById('g-tipo').value = t.tipo || 'cartao';
    document.getElementById('g-parcelas').value = t.parcelas || 1;
    document.getElementById('g-inicio-pagamento').value = t.delayPagamento || 0;
    
    // Resgata o banco e categoria
    if (t.banco) document.getElementById('g-banco').value = t.banco;
    if (t.categoria) document.getElementById('g-categoria').value = t.categoria;
    
    if (t.tipo === 'debito' && t.formaPagamento) {
        document.getElementById('g-forma-pagamento').value = t.formaPagamento;
    }

    // Resgata os terceiros
    const checkTerceiro = document.getElementById('g-terceiro');
    if (checkTerceiro) checkTerceiro.checked = t.eDeTerceiro || false;
    document.getElementById('g-nome-terceiro').value = t.nomeTerceiro || '';

    // Atualiza o visual das caixinhas (esconde/mostra dependendo do tipo resgatado)
    if (typeof ajustarCamposModal === 'function') ajustarCamposModal();
    if (typeof toggleCampoNomeTerceiro === 'function') toggleCampoNomeTerceiro();

    document.getElementById('modal-gasto').showModal();
}
function abrirModalEntrada() { document.getElementById('modal-entrada').showModal(); }

// O Cérebro do Contraste: Define a cor do banco e o contraste legível da letra
function getCor(b) {
    // 1. A paleta premium (Mais de 30 instituições)
    const cores = {
        'nubank': '#8A05BE',        
        'inter': '#FF7A00',         
        'c6': '#242424',            
        'neon': '#00E5FF',          
        'next': '#00FF5F',          
        'will': '#FFEB00',          
        'digio': '#151DE0',
        'iti': '#EC008C',           
        'pan': '#00A1FC',           
        'original': '#00C389',      
        'picpay': '#11C76F',        
        'mercado pago': '#009EE3',  
        'mercado livre': '#FFE600', 
        'pagbank': '#1DB76C',       
        'pagseguro': '#1DB76C',
        'xp': '#000000',            
        'rico': '#FF5C00',          
        'clear': '#000000',
        'btg': '#002B49',           
        'itau': '#EC7000',          
        'itaú': '#EC7000',          
        'bradesco': '#CC092F',      
        'santander': '#EC0000',     
        'bb': '#FCEB00',            
        'banco do brasil': '#FCEB00',
        'caixa': '#005CA9',         
        'sicredi': '#00B150',       
        'sicoob': '#00AE9D',        
        'banrisul': '#005CA9',      
        'safra': '#002855',         
        'bmg': '#FF6A13',           
        'bv': '#00A859',            
        'c&a': '#000000',           
        'mais': '#e63946'           
    };

    let corFundo = '#94a3b8'; // Cor neutra para bancos não mapeados (Cinza)
    
    // 2. Busca o banco e define a cor de fundo
    if (b) {
        const nomeLower = b.toLowerCase();
        for (const [chave, cor] of Object.entries(cores)) {
            if (nomeLower.includes(chave)) {
                corFundo = cor;
                break; // Achou o banco, para a pesquisa
            }
        }
    }

    // 3. O CÉREBRO MATEMÁTICO (Fórmula de Luminância YIQ)
    // Tira o "#" e converte para os canais Red, Green e Blue
    const hex = corFundo.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const bl = parseInt(hex.substring(4, 6), 16);
    
    // Calcula o brilho geral da cor
    const luminosidade = ((r * 299) + (g * 587) + (bl * 114)) / 1000;
    
    // Se a luminosidade for maior ou igual a 128 (clara como o Will ou BB), texto PRETO. Senão, texto BRANCO.
    const corTexto = luminosidade >= 128 ? '#000000' : '#ffffff';

    // 4. O Truque Ninja: Devolve as duas cores na mesma string de estilo!
    return `${corFundo}; color: ${corTexto} !important`;
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

function atualizarGraficoAnual() {
    const canvas = document.getElementById('graficoSalsi');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Agora usamos a variável de navegação do ano
const ano = anoFiltroGrafico; 
    const dados = Array(12).fill(0);

    for (let m = 0; m < 12; m++) {
        // 1. COMEÇA O MÊS COM AS ENTRADAS (Faz o saldo subir)
        let entradasDoMes = salsiData.entradas
            .filter(e => e.mes === m && e.ano === ano)
            .reduce((acc, curr) => acc + curr.valor, 0);
        
        let gastosDoMes = 0;

        // 2. CALCULA OS GASTOS CONFIRMADOS (Faz o saldo descer)
        salsiData.transacoes.forEach(t => {
            const d = new Date(t.dataCompra + "T00:00:00");
            const infoB = salsiData.config.detalhesBancos?.find(b => b.nome === t.banco);
            const f = infoB ? parseInt(infoB.fechamento) : 1;
            
            let mr = d.getMonth(); 
            if (d.getDate() >= f) mr += 1;
            
            const diff = (ano - d.getFullYear()) * 12 + (m - mr);

            if (diff >= 0 && diff < t.parcelas) {
                const v = t.tipo === 'cartao' ? t.valorParcela : t.valorTotal;

                // REGRA DE OURO: Só subtrai se não for fixo OU se for fixo PAGO
                if (t.tipo !== 'fixo' || (t.tipo === 'fixo' && t.pago === true)) {
                    gastosDoMes += v;
                }
            }
        });

        // 3. O RESULTADO É O SALDO FINAL DO MÊS
        dados[m] = entradasDoMes - gastosDoMes;
    }

    if (window.meuGrafico) window.meuGrafico.destroy();

    window.meuGrafico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"],
            datasets: [{
                data: dados,
                borderColor: '#96e6a1',
                backgroundColor: 'rgba(150, 230, 161, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 4, // Aumentei um pouco para marcar o mês
                pointBackgroundColor: '#1b3a32'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                // Configuração para mostrar valores acima dos pontos
                tooltip: { enabled: true }, // Mantém o detalhe no mouse
            },
            scales: {
                y: { display: false, padding: 20 },
                x: { grid: { display: false }, ticks: { color: '#7a8b87', font: { size: 10 } } }
            }
        }
    });
}

// 1. Abre/Fecha o menu cascata
function toggleMenuOpcoes(event) {
    event.stopPropagation();
    const menu = document.getElementById('menu-dropdown');
    menu.classList.toggle('active');
}

// 2. Lógica para fechar ao clicar em qualquer lugar da tela
document.addEventListener('click', function(event) {
    const menu = document.getElementById('menu-dropdown');
    const container = document.getElementById('container-opcoes');
    if (menu && menu.classList.contains('active') && !container.contains(event.target)) {
        menu.classList.remove('active');
    }
});

// 3. Função para limpar apenas os gastos do mês que você está vendo
function limparMesAtual() {
    if(confirm("Deseja apagar todos os gastos deste mês?")) {
        const m = dataFiltro.getMonth();
        const a = dataFiltro.getFullYear();
        salsiData.transacoes = salsiData.transacoes.filter(t => {
            const d = new Date(t.dataCompra + "T00:00:00");
            return !(d.getMonth() === m && d.getFullYear() === a);
        });
        renderizar();
    }
}

function toggleGrafico() {
    const card = document.getElementById('card-grafico');
    const seta = document.getElementById('chart-toggle-icon');
    
    card.classList.toggle('expanded');
    
    if (card.classList.contains('expanded')) {
        seta.style.transform = 'rotate(0deg)'; // Seta para baixo (aberto)
        setTimeout(atualizarGraficoAnual, 100);
    } else {
        // Altere aqui para -135deg para combinar com o ícone de metas
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
// 1. Função para Resetar TUDO na Nuvem e no Local
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
            editarGasto(index); // Puxa a função de edição que criamos!
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
    const card = document.getElementById('card-metas-acordeon');
    const seta = document.getElementById('meta-toggle-icon');
    
    card.classList.toggle('expanded');
    
    if (card.classList.contains('expanded')) {
        seta.style.transform = 'rotate(0deg)';
        setTimeout(atualizarGraficoMeta, 100); 
    } else {
        seta.style.transform = 'rotate(-135deg)'; // Padrão fechado
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

window.addEventListener('load', injetarAssinatura);
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
                mudarMes(1); // Usa a sua função original que já funciona perfeitamente!
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

// --- FUNÇÃO DA SAUDAÇÃO (PC E MOBILE) ---
function atualizarSaudacao(nomeCompleto) {
    if (!nomeCompleto) return;
    
    // Pega só o primeiro nome
    const primeiroNome = nomeCompleto.split(' ')[0];
    const hora = new Date().getHours();
    
    let saudacao = 'Boa noite';
    if (hora >= 5 && hora < 12) saudacao = 'Bom dia';
    else if (hora >= 12 && hora < 18) saudacao = 'Boa tarde';

    const htmlContent = `<span class="greet-time">${saudacao},</span><br><span class="greet-name">${primeiroNome}!</span>`;

    // 1. Atualiza e mostra a saudação na Sidebar (PC)
    const containerPC = document.getElementById('greeting-pc');
    if (containerPC) {
        containerPC.innerHTML = htmlContent;
        containerPC.style.display = 'block';
    }

    // 2. Atualiza a saudação na Home (Mobile)
    const containerMobile = document.getElementById('greeting-mobile');
    if (containerMobile) {
        containerMobile.innerHTML = htmlContent;
        // O display do mobile é controlado automaticamente pela classe 'mobile-only' no CSS
    }
}

// --- FUNÇÕES DO PERFIL ---
function abrirModalPerfil() {
    const user = window.auth.currentUser;
    if (user) {
        document.getElementById('perfil-nome').value = user.displayName || '';
        document.getElementById('perfil-email').value = user.email || '';
        document.getElementById('perfil-senha').value = ''; // Sempre limpo por segurança
        document.getElementById('modal-perfil').showModal();
        
        // Fecha o menu cascata
        document.getElementById('menu-dropdown').classList.remove('active');
    }
}

async function salvarPerfil() {
    const user = window.auth.currentUser;
    if (!user) return;

    const novoNome = document.getElementById('perfil-nome').value.trim();
    const novaSenha = document.getElementById('perfil-senha').value;
    const btn = document.querySelector('#modal-perfil button');
    
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        // Atualiza o nome se foi alterado
        if (novoNome && novoNome !== user.displayName) {
            await window.updateProfile(user, { displayName: novoNome });
            atualizarSaudacao(novoNome); // Atualiza a tela na hora
        }

        // Atualiza a senha se ele digitou algo
        if (novaSenha) {
            if (novaSenha.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
            await window.updatePassword(user, novaSenha);
        }

        alert("Perfil atualizado com sucesso!");
        document.getElementById('modal-perfil').close();
    } catch (error) {
        // Erro comum: o Firebase exige que o usuário tenha feito login "recentemente" para mudar a senha
        if (error.code === 'auth/requires-recent-login') {
            alert("Por segurança, você precisa sair da conta e entrar novamente para alterar a senha.");
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
    const card = document.getElementById('card-desejos-acordeon');
    const icone = document.getElementById('desejo-toggle-icon'); // Pega o ícone da seta
    
    if (card) {
        card.classList.toggle('expanded'); // O seu CSS faz a animação de abrir/fechar
        
        // Gira a seta consoante o estado do card
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
    // Marca no navegador do usuário que ele já fez o tutorial!
    localStorage.setItem('guget_onboarding_concluido', 'true');
}

// Verifica automaticamente ao carregar a página se o usuário é novo
document.addEventListener('DOMContentLoaded', () => {
    // Se a chave não existir no localStorage, é a primeira vez dele!
    if (!localStorage.getItem('guget_onboarding_concluido')) {
        // Dá um pequeno delay de 1 segundo para a tela carregar bonita antes do pop-up
        setTimeout(abrirOnboarding, 1000);
    }
});

























