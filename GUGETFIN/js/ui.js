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
    if (event) event.stopPropagation();

    const menu = document.getElementById('menu-dropdown');
    if (!menu) return;

    const vaiAbrir = !menu.classList.contains('active');
    menu.classList.toggle('active', vaiAbrir);
    document.body.classList.toggle('menu-opcoes-open', vaiAbrir);

    if (vaiAbrir) atualizarMenuTemaMobile();
}

function fecharMenuOpcoes() {
    const menu = document.getElementById('menu-dropdown');
    if (menu) menu.classList.remove('active');
    document.body.classList.remove('menu-opcoes-open');
}

function executarOpcaoMenuMobile(callback) {
    fecharMenuOpcoes();
    if (typeof callback === 'function') {
        setTimeout(callback, 80);
    }
}

function atualizarMenuTemaMobile() {
    const isDark = document.body.classList.contains('dark-theme');
    const state = document.getElementById('mobile-theme-state');
    const control = document.getElementById('mobile-theme-switch');

    if (state) state.textContent = isDark ? 'Ativado' : 'Desativado';
    if (control) control.classList.toggle('active', isDark);
}

// NOVA: Abre/Fecha o menu cascata do PC
function toggleMenuOpcoesPC(event) {
    event.stopPropagation();
    const menuPC = document.getElementById('menu-dropdown-pc');
    if (menuPC) menuPC.classList.toggle('active');
}

// 2. Lógica global para fechar os menus ao clicar em qualquer lugar da tela
document.addEventListener('click', function(event) {
    // Verifica e fecha o do Mobile
    const menuMob = document.getElementById('menu-dropdown');
    const contMob = document.getElementById('container-opcoes');
    if (menuMob && menuMob.classList.contains('active') && contMob && !contMob.contains(event.target)) {
        fecharMenuOpcoes();
    }
    
    // Verifica e fecha o do PC
    const menuPC = document.getElementById('menu-dropdown-pc');
    const contPC = document.getElementById('container-opcoes-pc');
    if (menuPC && menuPC.classList.contains('active') && contPC && !contPC.contains(event.target)) {
        menuPC.classList.remove('active');
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
function limparNomeCartaoCarteira(nome) {
    return (nome || "").replace(/\s*\(Débito\)\s*$/i, "").trim();
}

function normalizarHexCarteira(hex) {
    if (!hex) return "#64748b";

    let cor = String(hex).split(";")[0].trim();

    if (!cor.startsWith("#")) return "#64748b";

    cor = cor.replace("#", "");

    if (cor.length === 3) {
        cor = cor.split("").map(c => c + c).join("");
    }

    if (cor.length !== 6) return "#64748b";

    return "#" + cor;
}

function hexToRgbCarteira(hex) {
    const cor = normalizarHexCarteira(hex).replace("#", "");

    return {
        r: parseInt(cor.substring(0, 2), 16),
        g: parseInt(cor.substring(2, 4), 16),
        b: parseInt(cor.substring(4, 6), 16)
    };
}

function rgbToHexCarteira(r, g, b) {
    return "#" + [r, g, b]
        .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
        .join("");
}

function misturarCorCarteira(hexBase, hexAlvo, pesoAlvo) {
    const base = hexToRgbCarteira(hexBase);
    const alvo = hexToRgbCarteira(hexAlvo);

    return rgbToHexCarteira(
        base.r * (1 - pesoAlvo) + alvo.r * pesoAlvo,
        base.g * (1 - pesoAlvo) + alvo.g * pesoAlvo,
        base.b * (1 - pesoAlvo) + alvo.b * pesoAlvo
    );
}

function escaparHtmlCarteira(texto) {
    return String(texto || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function obterCartoesCarteira() {
    const detalhes = salsiData?.config?.detalhesBancos || [];
    const vistos = new Set();
    const resultado = [];

    detalhes.forEach((cartao, originalIndex) => {
        if (!cartao) return;

        let nome = cartao.nome || cartao.banco || cartao.titulo || '';
        nome = String(nome)
            .replace(/\s*\(Débito\)\s*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!nome) return;

        const nomeNormalizado = nome.toLowerCase();

        // Ignora placeholders antigos
        const nomesInvalidos = [
            'cadastre seus cartões!',
            'cadastre seus cartoes!',
            'novo cartão',
            'novo cartao',
            'cartão',
            'cartao'
        ];

        if (nomesInvalidos.includes(nomeNormalizado)) return;

        // Remove duplicados por nome limpo
        if (vistos.has(nomeNormalizado)) return;

        vistos.add(nomeNormalizado);

        resultado.push({
            ...cartao,
            nome,
            _originalIndex: originalIndex
        });
    });

    return resultado;
}

function renderizarCarteiraNoContainer(containerId, contadorId) {
    const lista = document.getElementById(containerId);
    const contador = contadorId ? document.getElementById(contadorId) : null;
    const cartoes = obterCartoesCarteira();

    if (contador) {
        contador.textContent = contadorId === 'settings-wallet-count'
            ? String(cartoes.length)
            : `${cartoes.length} cartão${cartoes.length === 1 ? '' : 'ões'}`;
    }

    if (!lista) return;

    const cardsHtml = cartoes.length > 0 ? cartoes.map((c, index) => {
    const nomeVisual = limparNomeCartaoCarteira(c.nome);
    const nomeSeguro = escaparHtmlCarteira(nomeVisual);

    const corBase = normalizarHexCarteira(getCor(c.nome));
    const corClara = misturarCorCarteira(corBase, "#ffffff", 0.22);
    const corEscura = misturarCorCarteira(corBase, "#000000", 0.30);

    const tipoCartao = c.isDebitoOnly ? "DÉBITO" : "CRÉDITO";

    const detalhesCartao = c.isDebitoOnly ? `
        <div class="wallet-card-info wallet-card-info-wide">
            <span>Tipo</span>
            <strong>Apenas débito</strong>
        </div>
    ` : `
        <div class="wallet-card-info">
            <span>Fechamento</span>
            <strong>Dia ${c.fechamento || '--'}</strong>
        </div>

        <div class="wallet-card-info">
            <span>Vencimento</span>
            <strong>Dia ${c.vencimento || '--'}</strong>
        </div>
    `;

    return `
        <article 
            class="wallet-card ${c.isDebitoOnly ? 'is-debito' : 'is-credito'}"
            data-wallet-index="${index}"
            style="
                --wallet-color: ${corBase};
                --wallet-light: ${corClara};
                --wallet-dark: ${corEscura};
            "
        >
            <div class="wallet-card-glow"></div>

            <button 
                type="button" 
                class="wallet-card-delete" 
                onclick="excluirCartaoConfig(${c._originalIndex})" 
                title="Excluir cartão"
            >
                ×
            </button>

            <div class="wallet-card-top">
                <div>
                    <span class="wallet-card-label">Guget Wallet</span>
                    <h5>${nomeSeguro}</h5>
                </div>

                <span class="wallet-card-type">${tipoCartao}</span>
            </div>

            <div class="wallet-card-middle">
                <div class="wallet-chip"></div>
                <div class="wallet-contactless">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>

            <div class="wallet-card-bottom">
                ${detalhesCartao}
            </div>
        </article>
    `;
}).join('') : `
    <div class="wallet-empty">
        <div class="wallet-empty-icon">💳</div>
        <strong>Nenhum cartão cadastrado</strong>
        <span>Adicione seu primeiro cartão para começar a organizar sua carteira.</span>
    </div>
`;

const navHtml = cartoes.length > 1 ? `
    <div class="wallet-carousel-nav">
        <div class="wallet-carousel-dots"></div>
    </div>
` : "";

lista.innerHTML = cardsHtml + navHtml;
lista.dataset.walletContainerId = containerId;
carteiraContainerAtual = containerId;

requestAnimationFrame(() => {
    iniciarCarouselCarteira();
});
}

function abrirModalCartoes() {
    if (typeof irParaConfiguracoes === 'function') {
        irParaConfiguracoes('organizacao');
        return;
    }

    renderizarCarteiraNoContainer('lista-cartoes-config', 'contador-cartoes-config');
    const modal = document.getElementById('modal-cartoes');
    if (modal) modal.showModal();
}

function atualizarOrganizacaoConfiguracoes() {
    if (typeof renderizarConfiguracoesOrganizacao === 'function') {
        renderizarConfiguracoesOrganizacao();
    }
}

function adicionarCartaoPorIds(ids) {
    let nome = document.getElementById(ids.nome)?.value.trim() || '';
    const checkbox = document.getElementById(ids.debito);
    const isDebito = checkbox ? checkbox.checked : false;

    if (!nome) {
        alert("Preencha o nome do cartão!");
        return;
    }

    // 2. Mágica das Datas: Ignora as datas se for débito
    const fechamento = isDebito ? null : parseInt(document.getElementById(ids.fechamento)?.value);
    const vencimento = isDebito ? null : parseInt(document.getElementById(ids.vencimento)?.value);

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
    const inputNome = document.getElementById(ids.nome);
    const inputFechamento = document.getElementById(ids.fechamento);
    const inputVencimento = document.getElementById(ids.vencimento);

    if (inputNome) inputNome.value = '';
    if (inputFechamento) inputFechamento.value = '';
    if (inputVencimento) inputVencimento.value = '';
    if (checkbox) {
        checkbox.checked = false;
        if (ids.box && document.getElementById(ids.box)) {
            document.getElementById(ids.box).style.opacity = '1';
            document.getElementById(ids.box).style.pointerEvents = 'auto';
        } else if (typeof toggleInputsDebito === 'function') {
            toggleInputsDebito();
        }
    }
    
    popularSelects();
    atualizarOrganizacaoConfiguracoes();
    renderizar(); 
}

// 2. Adiciona um novo cartão ao banco de dados
function adicionarNovoCartao() {
    adicionarCartaoPorIds({
        nome: 'nc-nome',
        debito: 'banco-apenas-debito',
        fechamento: 'nc-fechamento',
        vencimento: 'nc-vencimento',
        box: 'box-datas-cartao'
    });
}

function adicionarNovoCartaoConfiguracoes() {
    adicionarCartaoPorIds({
        nome: 'settings-nc-nome',
        debito: 'settings-banco-apenas-debito',
        fechamento: 'settings-nc-fechamento',
        vencimento: 'settings-nc-vencimento',
        box: 'settings-box-datas-cartao'
    });
}

// 3. Remove o cartão da lista de opções (mantém no histórico)
function excluirCartaoConfig(index) {
    if (confirm("Deseja ocultar este cartão das novas opções? (Gastos antigos não serão afetados)")) {
        salsiData.config.detalhesBancos.splice(index, 1);
        salsiData.config.bancos = salsiData.config.detalhesBancos.map(b => b.nome);
        popularSelects();
        atualizarOrganizacaoConfiguracoes();
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

function renderizarCategoriasConfiguracoes() {
    const lista = document.getElementById('settings-lista-categorias');
    const contador = document.getElementById('settings-category-count');
    if (!lista) return;

    const tags = salsiData.config.categorias || [];
    if (contador) contador.textContent = String(tags.length);

    lista.innerHTML = tags.length > 0 ? tags.map((tag, index) => {
        const tagSegura = escaparHtmlCarteira(tag);
        const cor = normalizarHexCarteira(getCor(tag));

        return `
            <article class="settings-category-chip" style="--category-color: ${cor};">
                <span class="settings-category-dot"></span>
                <strong>${tagSegura}</strong>
                <button type="button" onclick="excluirTagConfig(${index})" aria-label="Excluir categoria ${tagSegura}">×</button>
            </article>
        `;
    }).join('') : `
        <div class="settings-category-empty">
            <i class="fi fi-rr-tags"></i>
            <strong>Nenhuma categoria cadastrada</strong>
            <span>Crie sua primeira categoria para organizar melhor os lançamentos.</span>
        </div>
    `;
}

function renderizarConfiguracoesOrganizacao() {
    renderizarCarteiraNoContainer('settings-lista-cartoes', 'settings-wallet-count');
    renderizarCategoriasConfiguracoes();
}

// 1. Função para abrir o modal e listar as categorias atuais
function abrirModalCategorias() {
    if (typeof irParaConfiguracoes === 'function') {
        irParaConfiguracoes('organizacao');
        return;
    }

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

    const modal = document.getElementById('modal-categorias');
    if (modal) modal.showModal();
}

// 2. Função para salvar uma nova categoria digitada
function adicionarTagPorInput(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

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
    atualizarOrganizacaoConfiguracoes();
    renderizar(); // Salva no cache
}

function adicionarNovaTag() {
    adicionarTagPorInput('nt-nome');
}

function adicionarNovaTagConfiguracoes() {
    adicionarTagPorInput('settings-nt-nome');
}

// 3. Função para excluir uma categoria
function excluirTagConfig(index) {
    if (confirm("Deseja remover esta categoria? (Isso não apaga gastos antigos)")) {
        salsiData.config.categorias.splice(index, 1);
        popularSelects();
        atualizarOrganizacaoConfiguracoes();
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

    if (!check) {
        const ids = ['g-nome-terceiro', 'g-terceiro-user-id', 'g-terceiro-username'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        const tipo = document.getElementById('g-terceiro-tipo');
        const sugestoes = document.getElementById('g-terceiro-sugestoes');
        if (tipo) tipo.value = 'manual';
        if (sugestoes) sugestoes.innerHTML = '';
    }
}

let buscaTerceiroTimer = null;

async function buscarUsuariosTerceiro(valor) {
    const sugestoes = document.getElementById('g-terceiro-sugestoes');
    const tipo = document.getElementById('g-terceiro-tipo');
    const userId = document.getElementById('g-terceiro-user-id');
    const usernameInput = document.getElementById('g-terceiro-username');

    if (tipo) tipo.value = 'manual';
    if (userId) userId.value = '';
    if (usernameInput) usernameInput.value = '';
    if (!sugestoes) return;

    const termo = String(valor || '').trim().replace(/^@+/, '').toLowerCase();
    sugestoes.innerHTML = '';

    clearTimeout(buscaTerceiroTimer);

    if (termo.length < 2 || !window.collection || !window.query) return;

    buscaTerceiroTimer = setTimeout(async () => {
        try {
            const usuariosRef = window.collection(window.db, 'usernames');
            const q = window.query(
                usuariosRef,
                window.orderBy('usernameBusca'),
                window.where('usernameBusca', '>=', termo),
                window.where('usernameBusca', '<=', termo + '\uf8ff'),
                window.limit(5)
            );

            const snap = await window.getDocs(q);
            const resultados = [];

            snap.forEach(docSnap => {
                const publico = docSnap.data();
                if (!publico || !publico.username) return;
                if (window.auth?.currentUser?.uid === publico.uid) return;
                resultados.push(publico);
            });

            sugestoes.innerHTML = resultados.length ? resultados.map(user => `
                <button type="button" class="terceiro-suggestion-item" onclick="selecionarUsuarioTerceiro('${user.uid}', '${escaparHtmlCarteira(user.username)}', '${escaparHtmlCarteira(user.nome || user.username)}')">
                    <img src="${user.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" alt="">
                    <span>
                        <strong>${escaparHtmlCarteira(user.nome || user.username)}</strong>
                        <small>@${escaparHtmlCarteira(user.username)}</small>
                    </span>
                </button>
            `).join('') : '<div class="terceiro-suggestion-empty">Nenhum usuário encontrado. Será salvo como nome manual.</div>';
        } catch (error) {
            console.error('Erro ao buscar usuarios:', error);
            sugestoes.innerHTML = '<div class="terceiro-suggestion-empty">Não foi possível buscar usuários agora.</div>';
        }
    }, 320);
}

function selecionarUsuarioTerceiro(uid, username, nome) {
    const nomeInput = document.getElementById('g-nome-terceiro');
    const userId = document.getElementById('g-terceiro-user-id');
    const usernameInput = document.getElementById('g-terceiro-username');
    const tipo = document.getElementById('g-terceiro-tipo');
    const sugestoes = document.getElementById('g-terceiro-sugestoes');

    if (nomeInput) nomeInput.value = `@${username}`;
    if (userId) userId.value = uid;
    if (usernameInput) usernameInput.value = username;
    if (tipo) tipo.value = 'usuario';
    if (sugestoes) sugestoes.innerHTML = `<div class="terceiro-suggestion-selected">Vinculado a @${escaparHtmlCarteira(username)}</div>`;
}

async function criarSolicitacaoGastoTerceiro(transacao) {
    if (!transacao?.terceiro || transacao.terceiro.tipo !== 'usuario') return;
    if (!window.addDoc || !window.collection || !window.auth?.currentUser) return;

    const user = window.auth.currentUser;
    const perfil = salsiData?.config?.perfil || {};
    const enviadoPorNome = [perfil.nome, perfil.sobrenome].filter(Boolean).join(' ').trim() || user.displayName || 'Usuário';

    try {
        const docRef = await window.addDoc(
            window.collection(window.db, 'gastosCompartilhados'),
            montarPayloadGastoCompartilhado(transacao, {
                status: 'pendente',
                criadoEm: window.serverTimestamp ? window.serverTimestamp() : new Date().toISOString()
            })
        );

        transacao.terceiro.status = 'pendente';
        transacao.terceiro.solicitacaoId = docRef.id;
    } catch (error) {
        console.error('Erro ao enviar gasto compartilhado:', error);
        mostrarToast('Gasto salvo, mas a solicitação não foi enviada.');
    }
}

function montarPayloadGastoCompartilhado(transacao, extras = {}) {
    const user = window.auth?.currentUser;
    const perfil = salsiData?.config?.perfil || {};
    const enviadoPorNome = [perfil.nome, perfil.sobrenome].filter(Boolean).join(' ').trim() || user?.displayName || 'Usuário';

    return {
        gastoLocalId: transacao.criadoEm || Date.now(),
        enviadoPor: user?.uid || '',
        enviadoPorNome,
        enviadoPara: transacao.terceiro?.userId || '',
        enviadoParaUsername: transacao.terceiro?.username || '',
        nome: transacao.nome,
        valor: transacao.valorTotal,
        valorParcela: transacao.valorParcela,
        parcelas: transacao.parcelas,
        categoria: transacao.categoria,
        banco: transacao.banco,
        dataCompra: transacao.dataCompra,
        observacao: transacao.observacao || '',
        comprovanteUrl: transacao.comprovanteUrl || '',
        ...extras
    };
}

function moedaVisual(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function dataVisual(data) {
    if (!data) return 'Sem data';
    return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');
}

function parseMoedaVisual(valor) {
    return parseFloat(String(valor || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0;
}

function garantirEstruturaCaixinha() {
    if (!Array.isArray(salsiData.caixinha)) {
        salsiData.caixinha = [];
    }
}

function calcularSaldoCaixinha() {
    garantirEstruturaCaixinha();
    return salsiData.caixinha.reduce((total, mov) => {
        const valor = Number(mov.valor) || 0;
        return total + (mov.tipo === 'saida' ? -valor : valor);
    }, 0);
}

function obterMesVisualizacao() {
    if (typeof dataFiltro !== 'undefined' && dataFiltro instanceof Date) {
        return new Date(dataFiltro.getFullYear(), dataFiltro.getMonth(), 1);
    }

    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
}

function calcularParcelasPorMesVisual(t) {
    const total = Math.max(1, Number(t.parcelas || 1));
    const inicio = typeof calcularCompetenciaInicialGasto === 'function'
        ? calcularCompetenciaInicialGasto(t)
        : new Date(`${t.dataCompra}T12:00:00`);
    const mesBase = obterMesVisualizacao();
    const diffMeses = (mesBase.getFullYear() - inicio.getFullYear()) * 12 + (mesBase.getMonth() - inicio.getMonth());

    const faltam = diffMeses < 0
        ? total
        : Math.max(0, total - diffMeses);
    const parcelaAtual = diffMeses < 0
        ? 0
        : Math.min(total, diffMeses + 1);
    const concluidasAntesDoMes = Math.max(0, Math.min(total, diffMeses));
    const finalizado = faltam === 0;

    return {
        total,
        inicio,
        mesBase,
        diffMeses,
        parcelaAtual,
        faltam,
        finalizado,
        progresso: total ? Math.round((concluidasAntesDoMes / total) * 100) : 0
    };
}

function calcularRecebimentoTerceiro(t) {
    const total = Math.max(1, Number(t.parcelas || 1));
    const statusCompartilhado = obterStatusCompartilhado(t);

    if (statusCompartilhado === 'pago') {
        return {
            total,
            recebidas: total,
            pendentes: 0,
            concluido: true,
            valorPendente: 0
        };
    }

    if (total > 1) {
        const recebidas = Array.from({ length: total }).filter((_, index) => {
            return parcelaTerceiroRecebida(t, index);
        }).length;

        return {
            total,
            recebidas,
            pendentes: Math.max(0, total - recebidas),
            concluido: recebidas >= total,
            valorPendente: Math.max(0, total - recebidas) * (Number(t.valorParcela) || 0)
        };
    }

    const concluido = !!t.pago;

    return {
        total: 1,
        recebidas: concluido ? 1 : 0,
        pendentes: concluido ? 0 : 1,
        concluido,
        valorPendente: concluido ? 0 : Number(t.valorTotal || 0)
    };
}

function parcelaTerceiroRecebida(t, index) {
    const total = Math.max(1, Number(t?.parcelas || 1));

    if (total <= 1) {
        return !!t?.pago;
    }

    const mapaParcelas = t?.pagamentosParcelas || null;
    const temControlePorParcela = mapaParcelas && Object.keys(mapaParcelas).length > 0;

    if (!temControlePorParcela) {
        return !!t?.pago;
    }

    return mapaParcelas[index] === true || mapaParcelas[String(index)] === true;
}

function obterStatusCompartilhado(t) {
    if (!t?.terceiro || t.terceiro.tipo !== 'usuario') return 'manual';
    return t.terceiro.status || 'enviado';
}

function gastoTerceiroContaNoResumo(t) {
    const status = obterStatusCompartilhado(t);
    return status === 'manual' || status === 'aceito' || status === 'pago';
}

function labelStatusCompartilhado(status) {
    const labels = {
        manual: 'Manual',
        enviado: 'Aguardando aceite',
        pendente: 'Aguardando aceite',
        aceito: 'Aceito',
        contestado: 'Contestado',
        pago: 'Pago',
        arquivado: 'Arquivado'
    };

    return labels[status] || status || 'Manual';
}

function classeStatusCompartilhado(status) {
    if (status === 'contestado') return 'danger';
    if (status === 'enviado' || status === 'pendente') return 'warn';
    if (status === 'arquivado') return 'muted';
    return '';
}

let dividasRecebidasCache = {};

function renderizarVisualizacoes() {
    renderizarVisualTerceiros();
    renderizarVisualDividas();
    renderizarVisualParcelados();
    renderizarVisualCaixinha();
}

async function renderizarSolicitacoesRecebidas() {
    if (!window.auth?.currentUser || !window.collection || !window.query || !window.getDocs) {
        return [];
    }

    try {
        const q = window.query(
            window.collection(window.db, 'gastosCompartilhados'),
            window.where('enviadoPara', '==', window.auth.currentUser.uid),
            window.limit(50)
        );

        const snap = await window.getDocs(q);
        const resultado = [];
        snap.forEach(docSnap => {
            const item = { id: docSnap.id, ...docSnap.data() };
            if (item.status !== 'arquivado') resultado.push(item);
        });
        return resultado;
    } catch (error) {
        console.error('Erro ao buscar gastos recebidos:', error);
        return [];
    }
}

async function buscarSolicitacoesEnviadas() {
    if (!window.auth?.currentUser || !window.collection || !window.query || !window.getDocs) {
        return [];
    }

    try {
        const q = window.query(
            window.collection(window.db, 'gastosCompartilhados'),
            window.where('enviadoPor', '==', window.auth.currentUser.uid),
            window.limit(100)
        );

        const snap = await window.getDocs(q);
        const resultado = [];
        snap.forEach(docSnap => {
            const item = { id: docSnap.id, ...docSnap.data() };
            if (item.status !== 'arquivado') resultado.push(item);
        });
        return resultado;
    } catch (error) {
        console.error('Erro ao buscar gastos enviados:', error);
        return [];
    }
}

function sincronizarStatusGastosEnviados(enviados) {
    if (!Array.isArray(enviados) || !Array.isArray(salsiData.transacoes)) return;

    let alterou = false;

    enviados.forEach(item => {
        const gasto = salsiData.transacoes.find(t => {
            if (!t?.terceiro || t.terceiro.tipo !== 'usuario') return false;

            const mesmoDestino = t.terceiro.userId === item.enviadoPara;
            const mesmoId = String(t.criadoEm || '') === String(item.gastoLocalId || '');

            return mesmoDestino && mesmoId;
        });

        if (!gasto) return;

        if (!gasto.terceiro) gasto.terceiro = {};

        const novoStatus = item.status || 'enviado';
        if (gasto.terceiro.status !== novoStatus || gasto.terceiro.solicitacaoId !== item.id) {
            gasto.terceiro.status = novoStatus;
            gasto.terceiro.solicitacaoId = item.id;
            alterou = true;
        }
    });

    if (alterou) {
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
    }
}

async function obterSolicitacaoDoGasto(t) {
    if (!t?.terceiro || t.terceiro.tipo !== 'usuario') return null;

    if (t.terceiro.solicitacaoId) {
        return { id: t.terceiro.solicitacaoId };
    }

    const enviados = await buscarSolicitacoesEnviadas();
    const encontrado = enviados.find(item => {
        const mesmoDestino = item.enviadoPara === t.terceiro.userId;
        const mesmoId = String(item.gastoLocalId || '') === String(t.criadoEm || '');
        return mesmoDestino && mesmoId;
    });

    return encontrado || null;
}

async function reenviarGastoTerceiro(index) {
    const gasto = salsiData.transacoes[index];
    if (!gasto?.terceiro || gasto.terceiro.tipo !== 'usuario') return;
    if (!window.auth?.currentUser || !window.updateDoc || !window.doc) return;

    try {
        const solicitacao = await obterSolicitacaoDoGasto(gasto);

        if (solicitacao?.id) {
            await window.updateDoc(window.doc(window.db, 'gastosCompartilhados', solicitacao.id), {
                ...montarPayloadGastoCompartilhado(gasto),
                status: 'pendente',
                reenviadoEm: window.serverTimestamp ? window.serverTimestamp() : new Date().toISOString(),
                arquivadoEm: null,
                respondidoEm: null
            });

            gasto.terceiro.solicitacaoId = solicitacao.id;
        } else if (window.addDoc && window.collection) {
            const docRef = await window.addDoc(
                window.collection(window.db, 'gastosCompartilhados'),
                montarPayloadGastoCompartilhado(gasto, {
                    status: 'pendente',
                    criadoEm: window.serverTimestamp ? window.serverTimestamp() : new Date().toISOString()
                })
            );

            gasto.terceiro.solicitacaoId = docRef.id;
        }

        gasto.terceiro.status = 'pendente';
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();

        renderizarVisualTerceiros();
        if (typeof mostrarToast === 'function') mostrarToast('Gasto reenviado para aceite.');
    } catch (error) {
        console.error('Erro ao reenviar gasto:', error);
        if (typeof mostrarToast === 'function') mostrarToast('Não foi possível reenviar agora.');
    }
}

async function apagarGastoTerceiroContestado(index) {
    return apagarGastoTerceiroEnviado(index);
}

async function apagarGastoTerceiroEnviado(index) {
    const gasto = salsiData.transacoes[index];
    if (!gasto) return;

    if (!confirm(`Apagar "${gasto.nome || 'gasto'}" e remover da conta da outra pessoa?`)) return;

    try {
        const solicitacao = await obterSolicitacaoDoGasto(gasto);

        if (solicitacao?.id && window.updateDoc && window.doc) {
            await window.updateDoc(window.doc(window.db, 'gastosCompartilhados', solicitacao.id), {
                status: 'arquivado',
                arquivadoPor: window.auth?.currentUser?.uid || '',
                arquivadoEm: window.serverTimestamp ? window.serverTimestamp() : new Date().toISOString()
            });
        }

        salsiData.transacoes.splice(index, 1);
        localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
        if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
        renderizar();
        renderizarVisualTerceiros();
        renderizarVisualDividas();

        if (typeof mostrarToast === 'function') mostrarToast('Gasto apagado e solicitação removida.');
    } catch (error) {
        console.error('Erro ao apagar gasto de terceiro:', error);
        if (typeof mostrarToast === 'function') mostrarToast('Não foi possível apagar agora.');
    }
}

async function apagarDividaRecebida(id) {
    const divida = dividasRecebidasCache[id];
    if (!divida) return;

    if (!confirm(`Apagar "${divida.nome || 'dívida'}" da sua lista?`)) return;

    try {
        if (window.updateDoc && window.doc) {
            await window.updateDoc(window.doc(window.db, 'gastosCompartilhados', id), {
                status: 'arquivado',
                arquivadoPor: window.auth?.currentUser?.uid || '',
                arquivadoEm: window.serverTimestamp ? window.serverTimestamp() : new Date().toISOString()
            });
        }

        delete dividasRecebidasCache[id];
        renderizarVisualDividas();
        if (typeof mostrarToast === 'function') mostrarToast('Dívida removida da lista.');
    } catch (error) {
        console.error('Erro ao apagar dívida recebida:', error);
        if (typeof mostrarToast === 'function') mostrarToast('Não foi possível apagar agora.');
    }
}

async function renderizarVisualTerceiros() {
    const lista = document.getElementById('visual-lista-terceiros');
    const resumoPendentes = document.getElementById('visual-terceiros-pendentes');
    if (!lista) return;

    lista.innerHTML = '<div class="visual-empty">Atualizando status dos gastos enviados...</div>';

    const enviados = await buscarSolicitacoesEnviadas();
    sincronizarStatusGastosEnviados(enviados);

    const gastos = (salsiData.transacoes || [])
        .filter(t => t.eDeTerceiro)
        .sort((a, b) => new Date((b.dataCompra || '') + 'T12:00:00') - new Date((a.dataCompra || '') + 'T12:00:00'));

    const totalPendente = gastos.reduce((total, t) => {
        if (!gastoTerceiroContaNoResumo(t)) return total;
        return total + calcularRecebimentoTerceiro(t).valorPendente;
    }, 0);
    if (resumoPendentes) resumoPendentes.textContent = moedaVisual(totalPendente);

    const enviadosHtml = gastos.length ? `
        <div class="visual-section-label">Seus gastos de terceiros</div>
        ${gastos.map(t => {
            const idx = salsiData.transacoes.indexOf(t);
            const vinculado = t.terceiro?.tipo === 'usuario' && t.terceiro?.username;
            const nomeResponsavel = vinculado ? `@${t.terceiro.username}` : (t.nomeTerceiro || t.terceiro?.nomeManual || 'Nome manual');
            const recebimento = calcularRecebimentoTerceiro(t);
            const statusCompartilhado = obterStatusCompartilhado(t);
            const status = vinculado
                ? labelStatusCompartilhado(recebimento.concluido ? 'pago' : statusCompartilhado)
                : (recebimento.concluido ? 'Pago' : (recebimento.total > 1 ? `${recebimento.pendentes} pendente${recebimento.pendentes === 1 ? '' : 's'}` : 'Manual'));
            const statusClass = vinculado
                ? classeStatusCompartilhado(recebimento.concluido ? 'pago' : statusCompartilhado)
                : (recebimento.concluido ? '' : 'muted');
            const recebimentoTexto = recebimento.total > 1
                ? `Recebidas: ${recebimento.recebidas}/${recebimento.total}`
                : (recebimento.concluido ? 'Recebido' : 'Pendente');
            const acoesEnvio = vinculado
                ? `
                    <button type="button" class="visual-mini-btn danger" onclick="apagarGastoTerceiroEnviado(${idx})">Apagar</button>
                    ${statusCompartilhado === 'contestado' ? `<button type="button" class="visual-mini-btn primary" onclick="reenviarGastoTerceiro(${idx})">Enviar</button>` : ''}
                `
                : `<button type="button" class="visual-mini-btn danger" onclick="apagarGastoTerceiroEnviado(${idx})">Apagar</button>`;

            return `
                <div class="visual-card">
                    <div class="visual-card-main">
                        <span class="visual-item-kicker">${vinculado ? 'Vinculado a usuário' : 'Controle manual'}</span>
                        <div class="visual-card-title">
                            <span>${escaparHtmlCarteira(t.nome || 'Gasto')}</span>
                            <small class="visual-badge ${statusClass}">${status}</small>
                        </div>
                        <div class="visual-card-meta">
                            <span>${escaparHtmlCarteira(nomeResponsavel)}</span>
                            <span>${dataVisual(t.dataCompra)}</span>
                            <span>${escaparHtmlCarteira(t.categoria || 'Sem categoria')}</span>
                            <span>${Number(t.parcelas || 1)}x</span>
                            <span>${recebimentoTexto}</span>
                        </div>
                    </div>
                    <div class="visual-card-value">
                        <strong>${moedaVisual(t.valorTotal || 0)}</strong>
                        <div class="visual-card-actions">
                            ${acoesEnvio}
                            <button type="button" class="visual-mini-btn" onclick="verDetalhes(${idx})">Ver detalhes</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('')}
    ` : '';

    lista.innerHTML = enviadosHtml
        ? enviadosHtml
        : '<div class="visual-empty">Nenhum gasto de terceiro por enquanto. Quando cadastrar um responsável manual ou um @user, ele aparece aqui.</div>';
}

async function responderSolicitacaoGasto(id, status) {
    if (!window.updateDoc || !window.doc) return;

    try {
        await window.updateDoc(window.doc(window.db, 'gastosCompartilhados', id), {
            status,
            respondidoEm: window.serverTimestamp ? window.serverTimestamp() : new Date().toISOString()
        });

        if (typeof mostrarToast === 'function') {
            mostrarToast(status === 'aceito' ? 'Gasto aceito.' : 'Gasto contestado.');
        }

        renderizarVisualTerceiros();
        renderizarVisualDividas();
    } catch (error) {
        console.error('Erro ao responder solicitação:', error);
        if (typeof mostrarToast === 'function') mostrarToast('Não foi possível responder agora.');
    }
}

async function renderizarVisualDividas() {
    const lista = document.getElementById('visual-lista-dividas');
    const resumo = document.getElementById('visual-dividas-pendentes');
    if (!lista) return;

    lista.innerHTML = '<div class="visual-empty">Carregando dívidas recebidas...</div>';

    const dividas = await renderizarSolicitacoesRecebidas();
    dividasRecebidasCache = {};

    dividas.forEach(item => {
        dividasRecebidasCache[item.id] = item;
    });

    const pendentes = dividas.filter(item => (item.status || 'pendente') === 'pendente');
    const aceitas = dividas.filter(item => item.status === 'aceito');
    const contestadas = dividas.filter(item => item.status === 'contestado');
    const pagas = dividas.filter(item => item.status === 'pago');

    const totalPendente = [...pendentes, ...aceitas].reduce((total, item) => total + Number(item.valor || 0), 0);
    if (resumo) resumo.textContent = moedaVisual(totalPendente);

    const cardDivida = (item, tipo) => {
        const status = item.status || 'pendente';
        const statusLabel = labelStatusCompartilhado(status);
        const statusClass = classeStatusCompartilhado(status);
        const acoes = tipo === 'pendente'
            ? `
                <button type="button" class="visual-mini-btn danger" onclick="apagarDividaRecebida('${item.id}')">Apagar</button>
                <button type="button" class="visual-mini-btn" onclick="responderSolicitacaoGasto('${item.id}', 'contestado')">Contestar</button>
                <button type="button" class="visual-mini-btn primary" onclick="responderSolicitacaoGasto('${item.id}', 'aceito')">Aceitar</button>
            `
            : tipo === 'aceita'
                ? `
                    <button type="button" class="visual-mini-btn danger" onclick="apagarDividaRecebida('${item.id}')">Apagar</button>
                    <button type="button" class="visual-mini-btn primary" onclick="abrirPagamentoDivida('${item.id}')">Pagar</button>
                `
                : `<button type="button" class="visual-mini-btn danger" onclick="apagarDividaRecebida('${item.id}')">Apagar</button>`;

        return `
            <div class="visual-card">
                <div class="visual-card-main">
                    <span class="visual-item-kicker">Enviado por ${escaparHtmlCarteira(item.enviadoPorNome || 'Usuário')}</span>
                    <div class="visual-card-title">
                        <span>${escaparHtmlCarteira(item.nome || 'Dívida')}</span>
                        <small class="visual-badge ${statusClass}">${statusLabel}</small>
                    </div>
                    <div class="visual-card-meta">
                        <span>${dataVisual(item.dataCompra)}</span>
                        <span>${escaparHtmlCarteira(item.categoria || 'Sem categoria')}</span>
                        <span>${Number(item.parcelas || 1)}x de ${moedaVisual(item.valorParcela || item.valor || 0)}</span>
                        ${item.observacao ? `<span>${escaparHtmlCarteira(item.observacao)}</span>` : ''}
                    </div>
                </div>
                <div class="visual-card-value">
                    <strong>${moedaVisual(item.valor || 0)}</strong>
                    ${acoes ? `<div class="visual-card-actions">${acoes}</div>` : ''}
                </div>
            </div>
        `;
    };

    const html = [
        pendentes.length ? `<div class="visual-section-label">Solicitações pendentes</div>${pendentes.map(item => cardDivida(item, 'pendente')).join('')}` : '',
        aceitas.length ? `<div class="visual-section-label">Aceitas para pagamento</div>${aceitas.map(item => cardDivida(item, 'aceita')).join('')}` : '',
        contestadas.length ? `<div class="visual-section-label">Contestadas</div>${contestadas.map(item => cardDivida(item, 'historico')).join('')}` : '',
        pagas.length ? `<div class="visual-section-label">Pagas</div>${pagas.map(item => cardDivida(item, 'historico')).join('')}` : ''
    ].join('');

    lista.innerHTML = html || '<div class="visual-empty">Nenhuma dívida recebida por enquanto.</div>';
}

function abrirPagamentoDivida(id) {
    const divida = dividasRecebidasCache[id];
    if (!divida) {
        if (typeof mostrarToast === 'function') mostrarToast('Não encontrei essa dívida para pagamento.');
        return;
    }

    if (typeof abrirModalGasto === 'function') abrirModalGasto();

    window.dividaEmPagamentoId = id;
    window.dividaEmPagamentoDoc = divida;

    const nome = document.getElementById('g-nome');
    const valor = document.getElementById('g-valor');
    const data = document.getElementById('g-data');
    const obs = document.getElementById('g-observacao');
    const parcelas = document.getElementById('g-parcelas');
    const checkTerceiro = document.getElementById('g-terceiro');

    if (nome) nome.value = `Dívida - ${divida.nome || 'gasto compartilhado'}`;
    if (valor) {
        valor.value = (Number(divida.valor || 0) * 100).toFixed(0);
        formatarMoeda(valor);
    }
    if (data) data.value = new Date().toISOString().split('T')[0];
    if (parcelas) parcelas.value = 1;
    if (checkTerceiro) checkTerceiro.checked = false;
    if (typeof toggleCampoNomeTerceiro === 'function') toggleCampoNomeTerceiro();
    if (obs) {
        obs.value = `Pagamento de dívida enviada por ${divida.enviadoPorNome || 'usuário'} em ${dataVisual(divida.dataCompra)}.`;
    }

    if (typeof mostrarToast === 'function') {
        mostrarToast('Escolha como você quer pagar essa dívida.');
    }
}

function renderizarVisualParcelados() {
    const lista = document.getElementById('visual-lista-parcelados');
    if (!lista) return;

    const parcelados = (salsiData.transacoes || [])
        .filter(t => Number(t.parcelas || 1) > 1)
        .map(t => {
            return { t, ...calcularParcelasPorMesVisual(t) };
        })
        .sort((a, b) => {
            if (a.finalizado !== b.finalizado) return a.finalizado ? 1 : -1;
            return new Date((b.t.dataCompra || '') + 'T12:00:00') - new Date((a.t.dataCompra || '') + 'T12:00:00');
        });

    lista.innerHTML = parcelados.length ? parcelados.map(item => {
        const { t, parcelaAtual, faltam, total, finalizado, progresso } = item;
        const idx = salsiData.transacoes.indexOf(t);
        const textoParcela = item.diffMeses < 0
            ? 'Ainda não iniciou'
            : `Parcela atual: ${parcelaAtual}/${total}`;

        return `
            <div class="visual-card">
                <div class="visual-card-main">
                    <span class="visual-item-kicker">${escaparHtmlCarteira(t.banco || t.formaPagamento || 'Parcelado')}</span>
                    <div class="visual-card-title">
                        <span>${escaparHtmlCarteira(t.nome || 'Gasto parcelado')}</span>
                        <small class="visual-badge ${finalizado ? '' : 'warn'}">${finalizado ? 'Finalizado' : `${faltam} restante${faltam === 1 ? '' : 's'}`}</small>
                    </div>
                    <div class="visual-card-meta">
                        <span>${textoParcela}</span>
                        <span>Valor da parcela: ${moedaVisual(t.valorParcela || 0)}</span>
                        <span>${dataVisual(t.dataCompra)}</span>
                    </div>
                </div>
                <div class="visual-card-value">
                    <strong>${moedaVisual(t.valorTotal || 0)}</strong>
                    <div class="visual-progress" title="${progresso}% concluído">
                        <span style="width:${progresso}%"></span>
                    </div>
                    <button type="button" class="visual-mini-btn" onclick="verDetalhes(${idx})">Ver detalhes</button>
                </div>
            </div>
        `;
    }).join('') : '<div class="visual-empty">Nenhum gasto parcelado cadastrado ainda.</div>';
}

function renderizarVisualCaixinha() {
    garantirEstruturaCaixinha();

    const lista = document.getElementById('visual-lista-caixinha');
    const saldoHeader = document.getElementById('visual-caixinha-saldo');
    const saldoPrincipal = document.getElementById('caixinha-saldo-principal');
    if (!lista) return;

    const saldo = calcularSaldoCaixinha();
    if (saldoHeader) saldoHeader.textContent = moedaVisual(saldo);
    if (saldoPrincipal) saldoPrincipal.textContent = moedaVisual(saldo);

    const movimentos = [...salsiData.caixinha].sort((a, b) => new Date((b.data || '') + 'T12:00:00') - new Date((a.data || '') + 'T12:00:00'));

    lista.innerHTML = movimentos.length ? movimentos.map(mov => `
        <div class="visual-card">
            <div class="visual-card-main">
                <span class="visual-item-kicker">${mov.tipo === 'saida' ? 'Retirada' : 'Valor guardado'}</span>
                <div class="visual-card-title">
                    <span>${escaparHtmlCarteira(mov.nome || 'Movimento da caixinha')}</span>
                    <small class="visual-badge ${mov.tipo === 'saida' ? 'muted' : ''}">${mov.tipo === 'saida' ? 'Saiu da caixinha' : 'Entrou na caixinha'}</small>
                </div>
                <div class="visual-card-meta">
                    <span>${dataVisual(mov.data)}</span>
                    ${mov.descricao ? `<span>${escaparHtmlCarteira(mov.descricao)}</span>` : ''}
                    ${mov.comprovanteUrl ? `<span>Comprovante anexado</span>` : ''}
                </div>
            </div>
            <div class="visual-card-value">
                <strong>${mov.tipo === 'saida' ? '-' : '+'} ${moedaVisual(mov.valor || 0)}</strong>
                <div class="visual-card-actions">
                    ${mov.comprovanteUrl ? `<button type="button" class="visual-mini-btn" onclick="abrirComprovanteCaixinha('${mov.comprovanteUrl}')">Comprovante</button>` : ''}
                    <button type="button" class="visual-mini-btn" onclick="editarMovimentoCaixinha(${mov.id})">Editar</button>
                    <button type="button" class="visual-mini-btn danger" onclick="excluirMovimentoCaixinha(${mov.id})">Apagar</button>
                </div>
            </div>
        </div>
    `).join('') : '<div class="visual-empty">Sua caixinha ainda está vazia. Use Adicionar para registrar dinheiro guardado.</div>';
}

function abrirModalCaixinha(tipo = 'entrada') {
    const modal = document.getElementById('modal-caixinha');
    if (!modal) return;

    const hoje = new Date().toISOString().split('T')[0];
    const isSaida = tipo === 'saida';

    document.getElementById('caixinha-tipo').value = isSaida ? 'saida' : 'entrada';
    document.getElementById('caixinha-id').value = '';
    document.getElementById('caixinha-nome').value = '';
    document.getElementById('caixinha-valor').value = '';
    document.getElementById('caixinha-data').value = hoje;
    document.getElementById('caixinha-descricao').value = '';
    document.getElementById('caixinha-comprovante').value = '';

    const status = document.getElementById('caixinha-comprovante-status');
    if (status) status.textContent = 'Nenhum comprovante anexado';

    document.getElementById('caixinha-modal-kicker').textContent = isSaida ? 'Retirada' : 'Caixinha';
    document.getElementById('caixinha-modal-title').textContent = isSaida ? 'Retirar da caixinha' : 'Adicionar à caixinha';
    document.getElementById('caixinha-modal-desc').textContent = isSaida
        ? 'Registre um valor que saiu da sua reserva.'
        : 'Guardar dinheiro aqui também cria um gasto para reduzir o disponível do mês.';
    document.getElementById('btn-save-caixinha').textContent = isSaida ? 'Salvar retirada' : 'Guardar valor';

    modal.showModal();
    document.getElementById('caixinha-nome')?.focus();
}

function editarMovimentoCaixinha(id) {
    garantirEstruturaCaixinha();

    const movimento = salsiData.caixinha.find(mov => String(mov.id) === String(id));
    const modal = document.getElementById('modal-caixinha');
    if (!movimento || !modal) return;

    const isSaida = movimento.tipo === 'saida';

    document.getElementById('caixinha-id').value = movimento.id;
    document.getElementById('caixinha-tipo').value = movimento.tipo;
    document.getElementById('caixinha-nome').value = movimento.nome || '';
    document.getElementById('caixinha-valor').value = (Number(movimento.valor || 0) * 100).toFixed(0);
    formatarMoeda(document.getElementById('caixinha-valor'));
    document.getElementById('caixinha-data').value = movimento.data || new Date().toISOString().split('T')[0];
    document.getElementById('caixinha-descricao').value = movimento.descricao || '';
    document.getElementById('caixinha-comprovante').value = '';

    const status = document.getElementById('caixinha-comprovante-status');
    if (status) status.textContent = movimento.comprovanteUrl ? 'Comprovante atual mantido' : 'Nenhum comprovante anexado';

    document.getElementById('caixinha-modal-kicker').textContent = isSaida ? 'Editar retirada' : 'Editar caixinha';
    document.getElementById('caixinha-modal-title').textContent = isSaida ? 'Editar retirada' : 'Editar valor guardado';
    document.getElementById('caixinha-modal-desc').textContent = isSaida
        ? 'Ajuste o registro dessa retirada.'
        : 'Ajuste o registro e o gasto vinculado à caixinha.';
    document.getElementById('btn-save-caixinha').textContent = 'Salvar alterações';

    modal.showModal();
    document.getElementById('caixinha-nome')?.focus();
}

async function enviarComprovanteCaixinha(file) {
    if (!file) return '';

    const apiKey = '9ce95a3c98b6a4e35865fb7cf8b535db';
    const arquivoLeve = typeof comprimirImagem === 'function'
        ? await comprimirImagem(file)
        : file;
    const formData = new FormData();
    formData.append('image', arquivoLeve);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData
    });

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error ? data.error.message : 'Erro ao enviar comprovante');
    }

    return data.data.url;
}

async function salvarMovimentoCaixinha() {
    garantirEstruturaCaixinha();

    const tipo = document.getElementById('caixinha-tipo')?.value === 'saida' ? 'saida' : 'entrada';
    const idEdit = document.getElementById('caixinha-id')?.value || '';
    const indexEdit = salsiData.caixinha.findIndex(mov => String(mov.id) === String(idEdit));
    const movimentoAnterior = indexEdit >= 0 ? salsiData.caixinha[indexEdit] : null;
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

    let comprovanteUrl = movimentoAnterior?.comprovanteUrl || '';
    const textoOriginal = btn ? btn.textContent : '';

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Salvando...';
        }

        if (fileInput?.files?.length) {
            comprovanteUrl = await enviarComprovanteCaixinha(fileInput.files[0]);
        }

        const id = movimentoAnterior?.id || Date.now();
        const movimento = {
            id,
            tipo,
            nome,
            valor,
            data,
            descricao,
            comprovanteUrl,
            criadoEm: id
        };

        if (indexEdit >= 0) {
            salsiData.caixinha[indexEdit] = movimento;
        } else {
            salsiData.caixinha.push(movimento);
        }

        salsiData.transacoes = (salsiData.transacoes || []).filter(t => {
            return !(t.origemCaixinha && String(t.caixinhaId) === String(id));
        });

        if (tipo === 'entrada') {
            if (!salsiData.config.categorias.includes('Caixinha')) {
                salsiData.config.categorias.push('Caixinha');
            }

            salsiData.transacoes.push({
                nome: `Caixinha - ${nome}`,
                tipo: 'debito',
                valorTotal: valor,
                valorParcela: valor,
                parcelas: 1,
                dataCompra: data,
                banco: 'Caixinha',
                categoria: 'Caixinha',
                observacao: descricao,
                pago: true,
                delayPagamento: 0,
                eDeTerceiro: false,
                nomeTerceiro: '',
                terceiro: null,
                formaPagamento: 'Caixinha',
                comprovanteUrl,
                origemCaixinha: true,
                caixinhaId: id,
                criadoEm: id,
                destaqueAte: id + (5 * 60 * 1000)
            });
        }

        renderizar();
        renderizarVisualizacoes();
        document.getElementById('modal-caixinha')?.close();
        if (typeof mostrarToast === 'function') {
            mostrarToast(indexEdit >= 0 ? 'Movimento da caixinha atualizado.' : (tipo === 'saida' ? 'Retirada registrada.' : 'Valor guardado na caixinha.'));
        }
    } catch (error) {
        console.error('Erro ao salvar caixinha:', error);
        alert('Não foi possível salvar o movimento: ' + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = textoOriginal;
        }
    }
}

function excluirMovimentoCaixinha(id) {
    garantirEstruturaCaixinha();

    const movimento = salsiData.caixinha.find(mov => String(mov.id) === String(id));
    if (!movimento) return;

    if (!confirm(`Apagar "${movimento.nome || 'movimento da caixinha'}"?`)) return;

    salsiData.caixinha = salsiData.caixinha.filter(mov => String(mov.id) !== String(id));
    salsiData.transacoes = (salsiData.transacoes || []).filter(t => {
        return !(t.origemCaixinha && String(t.caixinhaId) === String(id));
    });

    renderizar();
    renderizarVisualizacoes();

    if (typeof mostrarToast === 'function') {
        mostrarToast('Movimento da caixinha apagado.');
    }
}

function abrirComprovanteCaixinha(url) {
    const img = document.getElementById('img-comprovante-preview');
    const modal = document.getElementById('modal-ver-comprovante');
    if (!img || !modal) return;

    img.src = url;
    modal.showModal();
}

document.getElementById('caixinha-comprovante')?.addEventListener('change', function() {
    const status = document.getElementById('caixinha-comprovante-status');
    if (status) {
        status.textContent = this.files?.[0]?.name || 'Nenhum comprovante anexado';
    }
});

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

function navegar(abaId) {
    const main = document.querySelector('main');
    if (main) {
        main.classList.remove('calendar-mode');
        main.classList.remove('visualizacoes-mode');
        main.classList.remove('settings-mode');
    }

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

function irParaVisualizacoesMobile(aba = 'terceiros') {
    const main = document.querySelector('main');
    if (main) {
        main.classList.remove('calendar-mode');
        main.classList.remove('settings-mode');
        main.classList.add('visualizacoes-mode');
    }

    document.querySelectorAll('.tab-content').forEach(secao => {
        secao.classList.remove('active');
        secao.style.setProperty('display', 'none', 'important');
    });

    if (typeof irParaVisualizacoes === 'function') {
        irParaVisualizacoes(aba);
    }

    document.querySelectorAll('.mobile-tab-bar .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelectorAll('.mobile-tab-bar .tab-btn').forEach(btn => {
        const acao = btn.getAttribute('onclick') || '';
        if (acao.includes('irParaVisualizacoesMobile')) {
            btn.classList.add('active');
        }
    });
}

function voltarAoTopoMobile() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function atualizarBotaoVoltarTopoMobile() {
    const btn = document.getElementById('mobile-back-top');
    if (!btn) return;

    const deveMostrar = window.innerWidth <= 1024 && window.scrollY > 620;
    btn.classList.toggle('visible', deveMostrar);
}

window.addEventListener('scroll', atualizarBotaoVoltarTopoMobile, { passive: true });
window.addEventListener('resize', atualizarBotaoVoltarTopoMobile);
document.addEventListener('DOMContentLoaded', atualizarBotaoVoltarTopoMobile);

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
        cardRes.classList.add('mobile-subtab-active');
        cardTer.classList.remove('mobile-subtab-active');
    } else {
        // Ativa botão Terceiros
        btnRes.classList.remove('active');
        btnTer.classList.add('active');

        // Alterna Cards
        cardRes.style.setProperty('display', 'none', 'important');
        cardTer.style.setProperty('display', 'block', 'important');
        cardRes.classList.remove('mobile-subtab-active');
        cardTer.classList.add('mobile-subtab-active');

        const listaTerceirosMobile = document.getElementById('lista-terceiros-mobile');
        if (listaTerceirosMobile) {
            listaTerceirosMobile.style.setProperty('display', 'flex', 'important');
            listaTerceirosMobile.style.setProperty('flex-direction', 'column', 'important');
        }

        garantirTerceirosMobileVisivel();

        setTimeout(() => {
            if (listaTerceirosMobile && !listaTerceirosMobile.innerHTML.trim()) {
                listaTerceirosMobile.innerHTML = `
                    <div class="cartao-item-mobile terceiro-mobile-empty">
                        <div>
                            <strong>Nenhum gasto de terceiro neste mês</strong>
                            <span>Quando houver lançamentos, eles aparecem aqui.</span>
                        </div>
                    </div>
                `;
            }
        }, 120);
    }
}

function garantirTerceirosMobileVisivel() {
    const cardTer = document.getElementById('card-terceiros');
    const lista = document.getElementById('lista-terceiros-mobile');
    const tabela = document.getElementById('tabela-terceiros');
    const total = document.querySelector('#card-terceiros .mobile-total-card');

    if (cardTer) {
        cardTer.classList.add('mobile-subtab-active');
        cardTer.style.setProperty('display', 'block', 'important');
        cardTer.style.setProperty('visibility', 'visible', 'important');
        cardTer.style.setProperty('opacity', '1', 'important');
        cardTer.style.setProperty('height', 'auto', 'important');
        cardTer.style.setProperty('min-height', '120px', 'important');
    }

    if (tabela && window.innerWidth <= 1024) {
        tabela.style.setProperty('display', 'none', 'important');
    }

    if (lista) {
        lista.style.setProperty('display', 'flex', 'important');
        lista.style.setProperty('flex-direction', 'column', 'important');
        lista.style.setProperty('gap', '12px', 'important');
        lista.style.setProperty('width', '100%', 'important');
    }

    if (total && window.innerWidth <= 1024) {
        total.style.setProperty('display', 'flex', 'important');
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

// --- SWIPE DE MESES RESTRITO A BARRA DE MESES MOBILE ---
let touchstartX = 0;
let touchstartY = 0;
let touchendX = 0;
let touchendY = 0;
let touchMonthNavAtivo = false;

document.addEventListener('touchstart', function(event) {
    const navMovel = document.getElementById('mobile-month-nav');
    touchMonthNavAtivo = !!(navMovel && navMovel.contains(event.target));
    if (!touchMonthNavAtivo) return;

    touchstartX = event.changedTouches[0].screenX;
    touchstartY = event.changedTouches[0].screenY;
}, {passive: true});

document.addEventListener('touchend', function(event) {
    if (!touchMonthNavAtivo) return;

    touchendX = event.changedTouches[0].screenX;
    touchendY = event.changedTouches[0].screenY;
    analisarMovimentoSwipe();
    touchMonthNavAtivo = false;
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

/* ========================================================= */
/* MODO PRIVACIDADE - OCULTAR VALORES                        */
/* ========================================================= */

let textosPrivacidadeOriginais = new Map();

function privacidadeAtiva() {
    return localStorage.getItem('guget_privacidade_valores') === 'true';
}

function mascararValoresTexto(texto) {
    if (!texto || typeof texto !== 'string') return texto;

    return texto
        // Valores em real: R$ 1.707,15 / R$ 1707.15 / R$ -1541.94
        .replace(/R\$\s*-?\d[\d.,]*/g, 'R$ ••••')

        // Percentuais: 350.9% / 62,6%
        .replace(/-?\d+(?:[.,]\d+)?\s?%/g, '••••%');
}

function deveIgnorarNoModoPrivacidade(node) {
    const parent = node.parentElement;
    if (!parent) return true;

    return !!parent.closest(`
        script,
        style,
        noscript,
        input,
        textarea,
        select,
        option,
        canvas,
        svg,
        .privacy-toggle-btn,
        .auth-overlay
    `);
}

function atualizarBotaoPrivacidadeValores() {
    const ocultar = privacidadeAtiva();

    document.querySelectorAll('.privacy-toggle-btn').forEach(btn => {
        const icone = btn.querySelector('i');

        btn.classList.toggle('is-active', ocultar);
        btn.title = ocultar ? 'Mostrar valores' : 'Ocultar valores';
        btn.setAttribute('aria-label', ocultar ? 'Mostrar valores' : 'Ocultar valores');

        if (icone) {
            icone.className = ocultar ? 'fi fi-rr-eye-crossed' : 'fi fi-rr-eye';
        }
    });
}

function restaurarValoresPrivacidade() {
    textosPrivacidadeOriginais.forEach((textoOriginal, textNode) => {
        if (textNode && textNode.isConnected) {
            textNode.textContent = textoOriginal;
        }
    });

    textosPrivacidadeOriginais.clear();
}

function ocultarValoresPrivacidade() {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                if (deveIgnorarNoModoPrivacidade(node)) {
                    return NodeFilter.FILTER_REJECT;
                }

                const texto = node.textContent || "";

                const temValor =
                    /R\$\s*-?\d[\d.,]*/.test(texto) ||
                    /-?\d+(?:[.,]\d+)?\s?%/.test(texto);

                return temValor
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            }
        }
    );

    const nodes = [];
    let node;

    while ((node = walker.nextNode())) {
        nodes.push(node);
    }

    nodes.forEach(textNode => {
        // Só salva o original uma vez
        if (!textosPrivacidadeOriginais.has(textNode)) {
            textosPrivacidadeOriginais.set(textNode, textNode.textContent);
        }

        textNode.textContent = mascararValoresTexto(textosPrivacidadeOriginais.get(textNode));
    });
}

function aplicarPrivacidadeValores() {
    const ocultar = privacidadeAtiva();

    document.body.classList.toggle('valores-ocultos', ocultar);

    if (ocultar) {
        ocultarValoresPrivacidade();
    } else {
        restaurarValoresPrivacidade();
    }

    atualizarBotaoPrivacidadeValores();
}

function alternarPrivacidadeValores() {
    const novoEstado = !privacidadeAtiva();

    localStorage.setItem('guget_privacidade_valores', String(novoEstado));
    aplicarPrivacidadeValores();
}

document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(aplicarPrivacidadeValores);
});

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

function ativarScrollCarteira() {
    const carousel = document.getElementById('lista-cartoes-config');
    if (!carousel || carousel.dataset.scrollCarteiraAtivo === "true") return;

    carousel.dataset.scrollCarteiraAtivo = "true";

    carousel.addEventListener('wheel', function(event) {
        const cards = carousel.querySelectorAll('.wallet-card');
        if (!cards.length) return;

        event.preventDefault();

        const direcao = event.deltaY > 0 ? 1 : -1;
        const passo = 98; // distância visual entre cartões sobrepostos

        carousel.scrollBy({
            top: direcao * passo,
            behavior: 'smooth'
        });
    }, { passive: false });
}

/* ========================================================= */
/* MINHA CARTEIRA - CARROSSEL 3D VERTICAL                    */
/* ========================================================= */

let carteiraIndexAtual = 0;
let carteiraWheelTravado = false;
let carteiraTouchStartY = 0;
let carteiraTouchStartX = 0;
let carteiraContainerAtual = 'settings-lista-cartoes';

function obterContainerCarteiraAtual() {
    return document.getElementById(carteiraContainerAtual)
        || document.getElementById('settings-lista-cartoes')
        || document.getElementById('lista-cartoes-config');
}

function limitarCarteiraIndex(index, total) {
    if (total <= 0) return 0;
    return Math.max(0, Math.min(index, total - 1));
}

function atualizarCarouselCarteira() {
    const carousel = obterContainerCarteiraAtual();
    if (!carousel) return;

    const cards = Array.from(carousel.querySelectorAll('.wallet-card'));
    const dotsContainer = carousel.querySelector('.wallet-carousel-dots');

    const total = cards.length;
    if (!total) return;

    carteiraIndexAtual = limitarCarteiraIndex(carteiraIndexAtual, total);

    cards.forEach((card, index) => {
        const diff = index - carteiraIndexAtual;
        const absDiff = Math.abs(diff);

        const isMobileCarteira = window.innerWidth <= 720;

        const x = isMobileCarteira ? diff * 78 : 0;
        const y = isMobileCarteira ? 0 : diff * 38;
const z = -absDiff * (isMobileCarteira ? 72 : 126);
const rotateX = isMobileCarteira ? 0 : diff * -5;
const rotateY = isMobileCarteira ? diff * 5 : 0;

const scale = index === carteiraIndexAtual
    ? 1
    : Math.max(
        isMobileCarteira ? 0.84 : 0.76,
        (isMobileCarteira ? 0.92 : 0.90) - absDiff * 0.045
    );

const opacity = absDiff > 3 ? 0 : Math.max(0.13, 1 - absDiff * 0.27);
const blur = absDiff === 0 ? 0 : Math.min(absDiff * 1.35, 4.2);

        card.classList.toggle('is-active', index === carteiraIndexAtual);
        card.classList.toggle('is-hidden', absDiff > 3);

        card.style.zIndex = String(100 - absDiff);
        card.style.opacity = opacity;
        card.style.filter = `blur(${blur}px)`;
        card.style.transform = `
            translate(-50%, -50%)
            translateX(${x}px)
            translateY(${y}px)
            translateZ(${z}px)
            rotateX(${rotateX}deg)
            rotateY(${rotateY}deg)
            scale(${scale})
        `;
    });

    if (dotsContainer) {
        dotsContainer.innerHTML = cards.map((_, index) => `
            <button 
                type="button" 
                class="wallet-carousel-dot ${index === carteiraIndexAtual ? 'active' : ''}" 
                onclick="irParaCarteira(${index})"
                aria-label="Ir para cartão ${index + 1}"
            ></button>
        `).join('');
    }
}

function irParaCarteira(index) {
    const carousel = obterContainerCarteiraAtual();
    const total = carousel ? carousel.querySelectorAll('.wallet-card').length : 0;
    carteiraIndexAtual = limitarCarteiraIndex(index, total);
    atualizarCarouselCarteira();
}

function moverCarteira(direcao) {
    irParaCarteira(carteiraIndexAtual + direcao);
}

function iniciarCarouselCarteira() {
    const carousel = obterContainerCarteiraAtual();
    if (!carousel) return;

    const cards = carousel.querySelectorAll('.wallet-card');
    if (!cards.length) return;

    carteiraIndexAtual = limitarCarteiraIndex(carteiraIndexAtual, cards.length);

    if (carousel.dataset.carouselCarteiraAtivo !== "true") {
        carousel.dataset.carouselCarteiraAtivo = "true";

        carousel.addEventListener('wheel', (event) => {
            event.preventDefault();

            if (carteiraWheelTravado) return;

            carteiraWheelTravado = true;

            const direcao = event.deltaY > 0 ? 1 : -1;
            moverCarteira(direcao);

            setTimeout(() => {
                carteiraWheelTravado = false;
            }, 520);
        }, { passive: false });

        carousel.addEventListener('touchstart', (event) => {
            carteiraTouchStartY = event.touches[0].clientY;
            carteiraTouchStartX = event.touches[0].clientX;
        }, { passive: true });

        carousel.addEventListener('touchend', (event) => {
            const isMobileCarteira = window.innerWidth <= 720;
            const endX = event.changedTouches[0].clientX;
            const endY = event.changedTouches[0].clientY;
            const diffX = carteiraTouchStartX - endX;
            const diffY = carteiraTouchStartY - endY;

            if (isMobileCarteira) {
                if (Math.abs(diffX) < 38 || Math.abs(diffX) < Math.abs(diffY)) return;
                moverCarteira(diffX > 0 ? 1 : -1);
                return;
            }

            if (Math.abs(diffY) < 35) return;
            moverCarteira(diffY > 0 ? 1 : -1);
        }, { passive: true });
    }

    atualizarCarouselCarteira();
}

function focarCampoInicialModal(selector) {
    setTimeout(() => {
        const campo = document.querySelector(selector);

        if (!campo) return;

        campo.focus({ preventScroll: true });

        // Se já tiver texto, seleciona para facilitar substituir
        if (campo.value && typeof campo.select === "function") {
            campo.select();
        }
    }, 80);
}
