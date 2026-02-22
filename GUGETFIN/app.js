let salsiData = JSON.parse(localStorage.getItem('salsifin_cache')) || (typeof bancoInicial !== 'undefined' ? bancoInicial : { config: { categorias: [], bancos: [] }, entradas: [], transacoes: [] });
let subAbaCartaoAtiva = 'credito';
let dataFiltro = new Date();
dataFiltro.setDate(1);

// Forçar estado inicial ao carregar a página APENAS NO MOBILE
window.addEventListener('DOMContentLoaded', () => {
    // Adicionamos a checagem de largura aqui também!
    if (window.innerWidth <= 1024) {
        const cardRes = document.getElementById('card-resumo-conteudo');
        const cardTer = document.getElementById('card-terceiros');
        
        if (cardRes && cardTer) {
            cardRes.style.setProperty('display', 'block', 'important');
            cardTer.style.setProperty('display', 'none', 'important');
        }
    } else {
        // NO PC: Garante que os estilos voltem ao padrão original caso o JS tenha mexido
        const cardTer = document.getElementById('card-terceiros');
        if (cardTer) {
            cardTer.style.display = ''; // Remove o 'none' forçado pelo JS
        }
    }
});

function iniciar() { popularSelects(); renderizar(); verificarLembreteBackup(); }

function popularSelects() {
    const cat = document.getElementById('g-categoria');
    const ban = document.getElementById('g-banco');
    if(cat) cat.innerHTML = salsiData.config.categorias.map(c => `<option value="${c}">${c}</option>`).join('');
    if(ban) ban.innerHTML = salsiData.config.bancos.map(b => `<option value="${b}">${b}</option>`).join('');
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
    const m = dataFiltro.getMonth();
    const a = dataFiltro.getFullYear();
    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
	
	salsiData.transacoes.sort((a, b) => new Date(a.dataCompra) - new Date(b.dataCompra));
    // ----------------------------------

    document.getElementById('display-mes-ano').innerText = `${mesesNomes[m]} ${a}`;
    document.getElementById('ano-badge-dinamico').innerText = a;

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

// RENDER MOBILE (Aba dedicada) - Adicione isso abaixo:
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

// Atualiza os totais (PC e Mobile se existir o ID)
document.getElementById('sidebar-total-valor').innerText = `R$ ${totalEnt.toFixed(2)}`;
const totalMob = document.getElementById('total-entradas-mobile');
if (totalMob) totalMob.innerText = `R$ ${totalEnt.toFixed(2)}`;
	
// 2. Limpeza de Tabelas (PC e Mobile)
const fTable = document.querySelector('#tabela-fixos tbody'), 
      cTable = document.querySelector('#tabela-cartao tbody'), 
      dTable = document.querySelector('#tabela-debito tbody'),
      tTable = document.querySelector('#lista-terceiros'),
      cMobile = document.getElementById('lista-cartao-mobile'),
      dMobile = document.getElementById('lista-debito-mobile');
	  fMobile = document.getElementById('lista-fixos-mobile'); // <--- Pega a lista mobile do Débito

// Limpa tabelas do PC
if(fTable) fTable.innerHTML = ''; 
if(cTable) cTable.innerHTML = ''; 
if(dTable) dTable.innerHTML = '';

// Limpa listas do Mobile e Terceiros
if(tTable) tTable.innerHTML = '';
if(cMobile) cMobile.innerHTML = ''; 
if(dMobile) dMobile.innerHTML = '';
if(fMobile) fMobile.innerHTML = ''; // <--- Limpa os cards de débito antes de renderizar

    // 3. Acumuladores do Mês
    let totalGastoMes = 0, totalCartMes = 0, totalFixoMes = 0, totalDebitoMes = 0;
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

			// --- DENTRO DO LOOP if (t.eDeTerceiro) ---
			if (t.eDeTerceiro) {
    temGastoTerceiro = true;
    const idx = salsiData.transacoes.indexOf(t);

    // 1. RENDER PC (Continua como tabela para não quebrar o layout desktop)
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

    // 2. RENDER MOBILE (Nova estética de card com labels)
    // Precisamos de um container no HTML chamado 'lista-terceiros-mobile'
    const mTerceiros = document.getElementById('lista-terceiros-mobile');
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
            // --- GASTOS PESSOAIS (SOMA NORMAL) ---
            else {
                if (t.tipo !== 'fixo' || (t.tipo === 'fixo' && t.pago === true)) {
                    totalGastoMes += val;
                    tagSum[t.categoria] = (tagSum[t.categoria] || 0) + val;
                }

                if (t.tipo === 'fixo') {
    if (t.pago === true) totalFixoMes += val;
    
    // 1. RENDER PC (Mantém a sua tabela original)
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

    // 2. RENDER MOBILE (Com a estética de cartão de crédito)
    if(fMobile) {
        const opacidadeMob = t.pago ? '1' : '0.6'; // Se não pagou, fica um pouco transparente
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
                        <input type="checkbox" ${t.pago ? 'checked' : ''} 
                            onclick="event.stopPropagation()" 
                            onchange="alternarStatusPago(${idx})" 
                            style="transform: scale(1.3); cursor: pointer; accent-color: #21c25e;">
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
    
    // Define a tag e a cor
    const formaPagTag = t.formaPagamento || 'Débito'; // Fallback para gastos antigos
    let corTag = '#4299e1'; // Azul padrão para Débito
    if (formaPagTag === 'PIX') corTag = '#32bcad'; // Verde-água para PIX
    if (formaPagTag === 'Dinheiro') corTag = '#48bb78'; // Verde para Dinheiro
    
    // 1. Alimenta a tabela do PC
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

    // 2. ALIMENTA OS CARDS MOBILE
    const dMobile = document.getElementById('lista-debito-mobile');
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

					// RENDER PC (Tabela original)
					cTable.innerHTML += `
						<tr class="desktop-only-row">
							<td style="font-weight: 500; cursor: pointer;" onclick="verDetalhes(${idx})">${t.nome}</td>
							<td style="color: var(--text-sec); font-size: 11px; text-align: center;">${diff + 1}/${t.parcelas}</td>
							<td style="text-align: center;"><span class="badge" style="background:${getCor(t.banco)}">${t.banco}</span></td>
							<td style="text-align: right; font-weight: 600;">R$ ${val.toFixed(2)}</td>
							<td style="text-align: center;"><button class="btn-del" onclick="excluirGasto(${idx})">×</button></td>
						</tr>`;

					// RENDER MOBILE (Cards modernos)
					const listaMob = document.getElementById('lista-cartao-mobile');
					if (listaMob) {
						listaMob.innerHTML += `
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

    // Controla visibilidade do card de terceiros
// No final da função renderizar(), logo após o fechamento do salsiData.transacoes.forEach
const cardTerceiros = document.getElementById('card-terceiros');


// 4. Injetar Totais nas Tabelas
    fTable.innerHTML += `<tr class="row-total"><td>TOTAL GASTOS FIXOS</td><td colspan="3">R$ ${totalFixoMes.toFixed(2)}</td></tr>`;
    dTable.innerHTML += `<tr class="row-total"><td>TOTAL DÉBITO / PIX</td><td></td><td colspan="2">R$ ${totalDebitoMes.toFixed(2)}</td></tr>`;
    cTable.innerHTML += `<tr class="row-total"><td colspan="3">TOTAL FATURA</td><td colspan="2">R$ ${totalCartMes.toFixed(2)}</td></tr>`;

    // 5. Resumo Mensal Central (Bancos e Tags)
    document.getElementById('resumo-bancos-lista').innerHTML = Object.entries(bankSum).map(([b,v]) => `<div class="bank-row"><span>${b}</span><span>R$ ${v.toFixed(2)}</span></div>`).join('') || "Sem gastos.";
	const containerLembretes = document.getElementById('container-lembretes-fatura');
if (containerLembretes) {
    containerLembretes.innerHTML = ''; 
    salsiData.config.detalhesBancos.forEach(ban => {
        const valorFatura = bankSum[ban.nome] || 0;
        if (valorFatura > 0) {
            const hoje = new Date().getDate();
            const vencimento = parseInt(ban.vencimento);
            const diasFaltando = vencimento - hoje;
            
            let bgCor = '#f8faf9'; 
            let borderCor = '#e2e8f0';
            let statusTexto = `Vence dia ${vencimento}`;
            
            if (diasFaltando <= 3 && diasFaltando >= 0) {
                bgCor = '#fff5f5'; 
                borderCor = '#feb2b2';
                statusTexto = `⚠️ Vence dia ${vencimento}!`;
            }

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
    document.getElementById('resumo-tags-lista').innerHTML = Object.entries(tagSum).map(([k,v]) => `<div class="bank-row"><span>${k}</span><span>R$ ${v.toFixed(2)}</span></div>`).join('');
    
    // 6. CÁLCULO ANUAL (Varre os 12 meses do ano selecionado)
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

            if (df >= 0 && df < t.parcelas && !t.eDeTerceiro) { // !t.eDeTerceiro ignora no gráfico
                const v = t.tipo === 'cartao' ? t.valorParcela : t.valorTotal;
                if (t.tipo !== 'fixo' || (t.tipo === 'fixo' && t.pago === true)) {
                    if (t.tipo === 'cartao') anCred += v; 
                    else if (t.tipo === 'debito') anDeb += v; 
                    else anFixo += v;
                }
            }
        });
    }

    document.getElementById('ann-entradas').innerText = `R$ ${anEnt.toFixed(2)}`;
    document.getElementById('ann-saidas').innerText = `R$ ${(anCred + anDeb + anFixo).toFixed(2)}`;
    document.getElementById('ann-credito').innerText = `R$ ${anCred.toFixed(2)}`;
    document.getElementById('ann-debito').innerText = `R$ ${anDeb.toFixed(2)}`;

    // 7. Finalização e Cache
    const saldoFinal = totalEnt - totalGastoMes;
    document.getElementById('resumo-saldo').innerText = `R$ ${saldoFinal.toFixed(2)}`;
    document.getElementById('resumo-cartao').innerText = `R$ ${totalCartMes.toFixed(2)}`;
    document.getElementById('resumo-porcentagem').innerText = `${totalEnt > 0 ? ((totalGastoMes/totalEnt)*100).toFixed(1) : 0}%`;

    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
    atualizarHumorSalsicha(saldoFinal);
    setTimeout(atualizarGraficoAnual, 100);
	
	// No final da função renderizar(), após o loop das transações:
function renderizar() {
    // ... (todo o seu código de loop e soma)

    // AJUSTE PARA MANTER A ABA ATIVA AO MUDAR O MÊS:
    if (window.innerWidth <= 1024) { // Só faz isso no mobile
        const btnTerceiros = document.getElementById('btn-show-terceiros');
        const cardRes = document.getElementById('card-resumo-conteudo');
        const cardTer = document.getElementById('card-terceiros');

        if (btnTerceiros && btnTerceiros.classList.contains('active')) {
            // Se o botão de terceiros estava ativo, mantém ele aparecendo
            cardRes.style.setProperty('display', 'none', 'important');
            cardTer.style.setProperty('display', 'block', 'important');
        } else {
            // Caso contrário, garante que o resumo apareça
            cardRes.style.setProperty('display', 'block', 'important');
            cardTer.style.setProperty('display', 'none', 'important');
        }
    }
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
}

function confirmarGasto() {
    let rawValue = document.getElementById('g-valor').value;
    // Remove o "R$", pontos de milhar e troca a vírgula por ponto
    const vTotal = parseFloat(rawValue.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    // Captura o tipo (cartao, debito, fixo)
    const tipo = document.getElementById('g-tipo').value; 
    const nParc = Math.max(1, parseInt(document.getElementById('g-parcelas').value) || 1);
    
    // NOVO: Captura o que o usuário escolheu no select de forma de pagamento
    const campoForma = document.getElementById('g-forma-pagamento');
    const formaPag = campoForma ? campoForma.value : 'Débito';

    salsiData.transacoes.push({
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
        // NOVO: Salva a forma de pagamento (se for débito) lá no banco de dados
        formaPagamento: (tipo === 'debito') ? formaPag : null
    });
    
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
function confirmarEntrada() { salsiData.entradas.push({ nome: document.getElementById('e-nome').value, valor: parseFloat(document.getElementById('e-valor').value), mes: dataFiltro.getMonth(), ano: dataFiltro.getFullYear() }); renderizar(); document.getElementById('modal-entrada').close(); }
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
function abrirModalGasto() { popularSelects(); ajustarCamposModal(); document.getElementById('modal-gasto').showModal(); }
function abrirModalEntrada() { document.getElementById('modal-entrada').showModal(); }
// Banco de dados de cores das marcas
function getCor(b) {
    const cores = {
        'Nubank': '#820ad1',        // Roxo Nubank
        'Inter': '#ff7a00',         // Laranja Inter
        'Mercado Pago': '#009ee3',  // Azul Mercado Pago
        'Mercado Livre': '#fff159', // Amarelo Mercado Livre
        'C&A': '#000000',           // Preto C&A
        'Mais': '#e63946',          // Vermelho Cartão Mais
        'Santander': '#ec0000',
        'Itaú': '#ec7000',
        'Bradesco': '#cc092f',
        'Digio': '#151de0',
        'PicPay': '#21c25e'
    };
    
    // Retorna a cor da marca ou um cinza neutro se não encontrar
    return cores[b] || '#94a3b8';
}
function importarDadosJS(event) { const leitor = new FileReader(); leitor.onload = function(e) { try { let conteudo = e.target.result.replace(/const bancoInicial\s*=\s*/, "").trim().replace(/;$/, ""); salsiData = JSON.parse(conteudo); localStorage.setItem('salsifin_cache', JSON.stringify(salsiData)); renderizar(); alert("Importado! 🐾"); } catch (erro) { alert("Erro!"); } }; leitor.readAsText(event.target.files[0]); }

function injetarAssinatura() {
    const segredo = "YXBwIHdlYiBjcmlhZG8gcG9yIDxhIGhyZWY9Imh0dHA6Ly93d3cubmljb2xhc25ldmVzLmNvbS5iciIgdGFyZ2V0PSJfYmxhbmsiPk7DrWNvbGFzIE5ldmVzPC9hPg==";
    const el = document.createElement('div');
    el.className = 'dev-signature';
    try { el.innerHTML = decodeURIComponent(escape(atob(segredo))); document.body.appendChild(el); } catch (e) { console.error(e); }
}

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

    lista.innerHTML = cartoes.length > 0 ? cartoes.map((c, index) => `
        <div class="cartao-item-card">
            <div>
                <span class="badge" style="background: ${getCor(c.nome)}; margin-bottom: 6px; display: inline-block;">${c.nome}</span>
                <div style="font-size: 10px; color: var(--text-sec); font-weight: 600;">
                    Fecha: ${c.fechamento} | Vence: ${c.vencimento || '--'}
                </div>
            </div>
            <button class="btn-del" onclick="excluirCartaoConfig(${index})">×</button>
        </div>
    `).join('') : "<p style='font-size:12px; opacity:0.5'>Nenhum cartão.</p>";

    document.getElementById('modal-cartoes').showModal();
}

// 2. Adiciona um novo cartão ao banco de dados
function adicionarNovoCartao() {
    const nome = document.getElementById('nc-nome').value.trim();
    const fechamento = parseInt(document.getElementById('nc-fechamento').value);
    const vencimento = parseInt(document.getElementById('nc-vencimento').value);

    if (!nome || !fechamento || !vencimento) {
        alert("Preencha todos os campos do cartão!");
        return;
    }

    // Adiciona ao array de detalhes e atualiza a lista de nomes
    if (!salsiData.config.detalhesBancos) salsiData.config.detalhesBancos = [];
    
    salsiData.config.detalhesBancos.push({ nome, fechamento, vencimento });
    salsiData.config.bancos = salsiData.config.detalhesBancos.map(b => b.nome);

    // Limpa campos e atualiza
    document.getElementById('nc-nome').value = '';
    document.getElementById('nc-fechamento').value = '';
    document.getElementById('nc-vencimento').value = '';
    
    popularSelects();
    abrirModalCartoes(); // Atualiza a lista visual
    renderizar(); // Salva no cache
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

// 1. Função para Resetar TUDO (Limpa o cache e recarrega a página)
function limparTudo() {
    if (confirm("⚠️ ATENÇÃO: Isso apagará todos os seus gastos, entradas e configurações salvos no navegador. Deseja continuar?")) {
        localStorage.removeItem('salsifin_cache'); // Remove o banco de dados do cache
        location.reload(); // Recarrega para voltar ao estado inicial do dados.js
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

    document.getElementById('modal-detalhes').showModal();
}

function toggleCampoNomeTerceiro() {
    const check = document.getElementById('g-terceiro').checked;
    document.getElementById('div-nome-terceiro').style.display = check ? 'block' : 'none';
}

// 1. DATA AUTOMÁTICA E RESET AO ABRIR
function abrirModalGasto() {
    popularSelects();
    ajustarCamposModal();
    
    // Define a data de hoje no formato YYYY-MM-DD
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('g-data').value = hoje;
    
    // Reseta o valor e parcelas
    document.getElementById('g-valor').value = '';
    document.getElementById('g-parcelas').value = 1;
    
    document.getElementById('modal-gasto').showModal();
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