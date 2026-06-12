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

    const blocoObs = document.getElementById('det-bloco-observacao');
    const textoObs = document.getElementById('det-observacao');

    if (blocoObs && textoObs) {
        if (t.observacao && t.observacao.trim() !== '') {
            blocoObs.style.display = 'block';
            textoObs.innerText = t.observacao;
        } else {
            blocoObs.style.display = 'none';
            textoObs.innerText = '';
        }
    }

// 🚀 NOVO: Controla a exibição do comprovante do gasto
    const blocoComp = document.getElementById('bloco-comprovante-gasto');
    const btnComp = document.getElementById('btn-ver-comprovante-gasto');

    if (blocoComp && btnComp) {
        if (t.comprovanteUrl) {
            blocoComp.style.display = 'block';
            btnComp.onclick = () => {
                document.getElementById('img-comprovante-preview').src = t.comprovanteUrl;
                document.getElementById('modal-ver-comprovante').showModal();
            };
        } else {
            blocoComp.style.display = 'none';
        }
    }

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
                
                // 👇 A CORREÇÃO ESTÁ AQUI: Puxa o 'span' atualizado na tela em tempo real
                container.querySelector('.dropdown-trigger span').innerText = val === 'Todos' ? textoPadrao : val;
                
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

// ==========================================
// ⌨️ ATALHOS DE TECLADO (SHORTCUTS)
// ==========================================

document.addEventListener('keydown', function(event) {
    // 1. Trava de Segurança: Ignorar se o utilizador estiver a digitar dentro de um formulário
    const tagAtiva = document.activeElement.tagName;
    const aDigitar = tagAtiva === 'INPUT' || tagAtiva === 'TEXTAREA' || tagAtiva === 'SELECT';

    if (aDigitar) return; // Se estiver a escrever, não faz nada!

    // 2. Verifica se o Ctrl (Windows) ou Cmd (Mac) está a ser pressionado
    if (event.ctrlKey || event.metaKey) {
        
        // 🟢 CTRL + E (Nova Entrada)
        if (event.key.toLowerCase() === 'e') {
            event.preventDefault(); // Bloqueia a ação padrão do navegador!
            if (typeof abrirModalEntrada === 'function') {
                abrirModalEntrada();
            }
        }
        
        // 🔴 CTRL + G (Novo Gasto)
        if (event.key.toLowerCase() === 'g') {
            event.preventDefault(); // Bloqueia a ação padrão do navegador!
            if (typeof abrirModalGasto === 'function') {
                abrirModalGasto();
            }
        }
    }
});
