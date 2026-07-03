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
        // NO CELULAR: respeita a subaba ativa. Resize de navegador mobile
        // não pode resetar "Gastos de Terceiros" para vazio.
        const cardRes = document.getElementById('card-resumo-conteudo');
        const cardTer = document.getElementById('card-terceiros');
        const btnTer = document.getElementById('btn-show-terceiros');
        const terceiroAtivo = btnTer && btnTer.classList.contains('active');
        
        if (terceiroAtivo) {
            if (cardRes) {
                cardRes.classList.remove('mobile-subtab-active');
                cardRes.style.setProperty('display', 'none', 'important');
            }
            if (cardTer) {
                cardTer.classList.add('mobile-subtab-active');
                cardTer.style.setProperty('display', 'block', 'important');
            }
            if (typeof garantirTerceirosMobileVisivel === 'function') {
                garantirTerceirosMobileVisivel();
            }
        } else {
            if (cardRes) {
                cardRes.classList.add('mobile-subtab-active');
                cardRes.style.setProperty('display', 'block', 'important');
            }
            if (cardTer) {
                cardTer.classList.remove('mobile-subtab-active');
                cardTer.style.setProperty('display', 'none', 'important');
            }
        }
    } else {
        const main = document.querySelector('main');
        if (main && (
            main.classList.contains('calendar-mode') ||
            main.classList.contains('visualizacoes-mode') ||
            main.classList.contains('settings-mode')
        )) {
            return;
        }

        // NO PC: Arranca o "none !important" das abas mães e dos cards!
        const elementosParaMostrar = [
            'aba-resumo',           // A aba mãe do resumo
            'aba-home',
            'aba-fixos',
            'aba-debito',
            'aba-cartao',
            'aba-resumo-home',
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

const PRIMEIROS_PASSOS_DASHBOARD = [
    {
        id: 'carteira',
        titulo: 'Carteira',
        texto: 'Cartões e contas',
        icone: 'fi fi-rr-credit-card',
        acao: 'organizacao',
        descricao: 'Cadastre pelo menos um cartão ou conta. É isso que permite separar suas compras por origem e calcular faturas corretamente.'
    },
    {
        id: 'categorias',
        titulo: 'Categorias',
        texto: 'Tags de compra',
        icone: 'fi fi-rr-tags',
        acao: 'organizacao',
        descricao: 'Escolha suas categorias de compra. Assim cada gasto entra no lugar certo e o resumo mensal fica útil desde o começo.'
    },
    {
        id: 'credito',
        titulo: 'Crédito',
        texto: 'Gasto no cartão',
        icone: 'fi fi-rr-receipt',
        acao: 'credito',
        descricao: 'Cadastre um gasto no cartão de crédito para entender parcelas, fatura e competência do mês.'
    },
    {
        id: 'debito',
        titulo: 'Débito/Pix',
        texto: 'Saída à vista',
        icone: 'fi fi-rr-wallet',
        acao: 'debito',
        descricao: 'Registre uma saída à vista, como débito, Pix ou dinheiro. Ela entra direto no mês da compra.'
    },
    {
        id: 'fixos',
        titulo: 'Fixos',
        texto: 'Conta recorrente',
        icone: 'fi fi-rr-thumbtack',
        acao: 'fixos',
        descricao: 'Cadastre uma conta recorrente. Gastos fixos ajudam a enxergar compromissos que voltam todo mês.'
    },
    {
        id: 'terceiros',
        titulo: 'Terceiros',
        texto: 'Gasto de alguém',
        icone: 'fi fi-rr-users-alt',
        acao: 'terceiros',
        descricao: 'Use terceiros quando alguém utilizar seu cartão. Você pode vincular um @user ou guardar apenas um nome.'
    },
    {
        id: 'entradas',
        titulo: 'Entradas',
        texto: 'Dinheiro recebido',
        icone: 'fi fi-rr-usd-circle',
        acao: 'entrada',
        descricao: 'Cadastre dinheiro recebido, como salário, serviço ou reembolso. Isso alimenta saldo e percentual da renda.'
    },
    {
        id: 'calendario',
        titulo: 'Calendário',
        texto: 'Tudo por data',
        icone: 'fi fi-rr-calendar',
        acao: 'calendario',
        descricao: 'Veja seus lançamentos por data no calendário. Use os filtros para comparar gastos, terceiros e entradas.'
    },
    {
        id: 'visualizacoes',
        titulo: 'Visualizações',
        texto: 'Controle detalhado',
        icone: 'fi fi-rr-chart-pie-alt',
        acao: 'visualizacoes',
        descricao: 'Acompanhe parcelamentos, terceiros, dívidas e caixinha fora da dashboard principal.'
    }
];

function obterConfigPrimeirosPassosDashboard() {
    if (!salsiData.config) salsiData.config = {};
    if (!salsiData.config.primeirosPassosDashboard) {
        salsiData.config.primeirosPassosDashboard = {};
    }
    return salsiData.config.primeirosPassosDashboard;
}

function existeCartaoCarteira() {
    const detalhes = salsiData.config?.detalhesBancos || [];
    const bancos = salsiData.config?.bancos || [];

    return detalhes.some(cartao => {
        const nome = String(cartao?.nome || '').trim().toLowerCase();
        return nome && nome !== 'cadastre seus cartões!' && nome !== 'cadastre seus cartoes!';
    }) || bancos.some(nome => {
        const nomeLimpo = String(nome || '').trim().toLowerCase();
        return nomeLimpo && nomeLimpo !== 'cadastre seus cartões!' && nomeLimpo !== 'cadastre seus cartoes!';
    });
}

function primeiroPassoDashboardConcluido(id) {
    const config = obterConfigPrimeirosPassosDashboard();
    const transacoes = Array.isArray(salsiData.transacoes) ? salsiData.transacoes : [];
    const entradas = Array.isArray(salsiData.entradas) ? salsiData.entradas : [];
    const categorias = Array.isArray(salsiData.config?.categorias) ? salsiData.config.categorias : [];

    const mapa = {
        carteira: () => existeCartaoCarteira(),
        categorias: () => categorias.length > 0,
        credito: () => transacoes.some(t => t?.tipo === 'cartao'),
        debito: () => transacoes.some(t => t?.tipo === 'debito'),
        fixos: () => transacoes.some(t => t?.tipo === 'fixo'),
        terceiros: () => transacoes.some(t => t?.eDeTerceiro || t?.terceiro?.tipo === 'usuario' || t?.terceiro?.tipo === 'manual'),
        entradas: () => entradas.length > 0,
        calendario: () => config.calendario === true,
        visualizacoes: () => config.visualizacoes === true
    };

    return Boolean(mapa[id]?.());
}

function atualizarPrimeirosPassosDashboard() {
    const wrapper = document.getElementById('primeiros-passos-dashboard');
    const track = document.getElementById('first-steps-track');
    const progressText = document.getElementById('first-steps-progress-text');

    if (!wrapper || !track) return;

    const estados = PRIMEIROS_PASSOS_DASHBOARD.map((passo) => ({
        ...passo,
        concluido: primeiroPassoDashboardConcluido(passo.id)
    }));

    const concluidos = estados.filter(passo => passo.concluido).length;
    const primeiroPendente = estados.find(passo => !passo.concluido)?.id;

    if (progressText) {
        progressText.textContent = `${concluidos}/${estados.length} concluídos`;
    }

    wrapper.classList.toggle('is-complete', concluidos === estados.length);

    track.innerHTML = estados.map((passo, index) => `
        <button
            type="button"
            class="first-step-item ${passo.concluido ? 'is-done' : ''} ${passo.id === primeiroPendente ? 'is-current' : ''}"
            onclick="executarPrimeiroPassoDashboard('${passo.acao}', '${passo.id}')"
            aria-label="${passo.titulo}: ${passo.texto}"
        >
            <span class="first-step-node">
                <span class="first-step-index">${index + 1}</span>
                <i class="${passo.icone}"></i>
            </span>
            <span class="first-step-copy">
                <strong>${passo.titulo}</strong>
                <small>${passo.texto}</small>
            </span>
        </button>
    `).join('');
}

function marcarPrimeiroPassoDashboard(id, opcoes = {}) {
    const config = obterConfigPrimeirosPassosDashboard();
    if (config[id] === true) return;

    config[id] = true;
    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));

    if (!opcoes.localOnly && typeof salvarNoFirebase === 'function') {
        salvarNoFirebase();
    }

    atualizarPrimeirosPassosDashboard();
}

function prepararModalGastoPrimeiroPasso(tipo, terceiro = false) {
    if (typeof abrirModalGasto !== 'function') return;

    abrirModalGasto();

    setTimeout(() => {
        const tipoGasto = document.getElementById('g-tipo');
        const checkTerceiro = document.getElementById('g-terceiro');

        if (tipoGasto) {
            tipoGasto.value = tipo;
        }

        if (checkTerceiro) {
            checkTerceiro.checked = terceiro;
        }

        if (typeof atualizarListaBancos === 'function') atualizarListaBancos();
        if (typeof ajustarCamposModal === 'function') ajustarCamposModal();
        if (typeof toggleCampoNomeTerceiro === 'function') toggleCampoNomeTerceiro();
    }, 80);
}

function fecharNotificacaoPrimeiroPassoDashboard() {
    const toast = document.getElementById('first-step-toast');
    if (toast) {
        toast.classList.remove('is-visible');
    }
}

function mostrarNotificacaoPrimeiroPassoDashboard(id) {
    if (window.innerWidth <= 1024) return;

    const passo = PRIMEIROS_PASSOS_DASHBOARD.find(item => item.id === id);
    if (!passo) return;

    let toast = document.getElementById('first-step-toast');
    if (!toast) {
        toast = document.createElement('aside');
        toast.id = 'first-step-toast';
        toast.className = 'first-step-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
    }

    const dialogAberto = Array.from(document.querySelectorAll('dialog[open]')).pop();
    const host = dialogAberto || document.body;
    host.appendChild(toast);
    toast.classList.toggle('is-over-dialog', Boolean(dialogAberto));

    const etapa = PRIMEIROS_PASSOS_DASHBOARD.findIndex(item => item.id === id) + 1;
    const numeroEtapa = String(etapa).padStart(2, '0');

    toast.innerHTML = `
        <button type="button" class="first-step-toast-close" onclick="fecharNotificacaoPrimeiroPassoDashboard()" aria-label="Fechar aviso">&times;</button>
        <span class="first-step-toast-kicker">Etapa ${numeroEtapa}</span>
        <strong>${passo.titulo}</strong>
        <p>${passo.descricao}</p>
    `;

    clearTimeout(window.firstStepToastTimer);
    toast.classList.add('is-visible');
    window.firstStepToastTimer = setTimeout(fecharNotificacaoPrimeiroPassoDashboard, 11000);
}

function executarPrimeiroPassoDashboard(acao, passoId) {
    const executarAcao = () => {
        switch (acao) {
            case 'organizacao':
                if (typeof irParaConfiguracoes === 'function') irParaConfiguracoes('organizacao');
                break;
            case 'credito':
                prepararModalGastoPrimeiroPasso('cartao', false);
                break;
            case 'debito':
                prepararModalGastoPrimeiroPasso('debito', false);
                break;
            case 'fixos':
                prepararModalGastoPrimeiroPasso('fixo', false);
                break;
            case 'terceiros':
                prepararModalGastoPrimeiroPasso('cartao', true);
                break;
            case 'entrada':
                if (typeof abrirModalEntrada === 'function') abrirModalEntrada();
                break;
            case 'calendario':
                marcarPrimeiroPassoDashboard('calendario');
                if (typeof irParaCalendario === 'function') irParaCalendario();
                break;
            case 'visualizacoes':
                marcarPrimeiroPassoDashboard('visualizacoes');
                if (typeof irParaVisualizacoes === 'function') irParaVisualizacoes('terceiros');
                break;
            default:
                break;
        }
    };

    const abreModal = ['credito', 'debito', 'fixos', 'terceiros', 'entrada'].includes(acao);
    executarAcao();
    setTimeout(() => mostrarNotificacaoPrimeiroPassoDashboard(passoId), abreModal ? 140 : 80);
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

function calcularCompetenciaPorVencimentoFatura(dataCompra, fechamento, vencimento) {
    const diaCompra = dataCompra.getDate();
    const mesFechamento = dataCompra.getMonth() + (diaCompra <= fechamento ? 0 : 1);
    const anoFechamento = dataCompra.getFullYear();

    /*
        A competência passa a seguir o vencimento da fatura.
        Ex: fechamento 28 / vencimento 9.
        Compra 22/06 => fechamento 28/06 => vencimento 09/07 => competência julho.
        Compra 29/06 => fechamento 28/07 => vencimento 09/08 => competência agosto.
    */
    const mesVencimento = mesFechamento + (vencimento <= fechamento ? 1 : 0);

    return new Date(anoFechamento, mesVencimento, 1);
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

    if (!detalhesBanco || detalhesBanco.isDebitoOnly || !detalhesBanco.fechamento || !detalhesBanco.vencimento) {
        return criarDataCompetencia(dataCompra, 0);
    }

    const fechamento = parseInt(detalhesBanco.fechamento);
    const vencimento = parseInt(detalhesBanco.vencimento);

    return calcularCompetenciaPorVencimentoFatura(dataCompra, fechamento, vencimento);
}

function calcularSaldoCaixinhaDashboard() {
    if (!Array.isArray(salsiData.caixinha)) return 0;

    return salsiData.caixinha.reduce((total, movimento) => {
        const valor = parseFloat(movimento.valor) || 0;
        return total + (movimento.tipo === 'saida' ? -valor : valor);
    }, 0);
}

function atualizarCardCaixinhaDashboard() {
    const card = document.getElementById('stat-caixinha-dashboard');
    const valor = document.getElementById('resumo-caixinha');
    const mostrar = salsiData?.config?.mostrarCaixinhaDashboard === true;

    document.body.classList.toggle('dashboard-caixinha-enabled', mostrar);

    if (card) card.style.removeProperty('display');
    if (valor) valor.innerText = `R$ ${calcularSaldoCaixinhaDashboard().toFixed(2)}`;
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
                const statusArquivado = t.terceiro?.tipo === 'usuario' && t.terceiro.status === 'arquivado';
                if (statusArquivado) return;

                // 2. A barreira de Filtro de Terceiros!
                if (fTercNome !== 'Todos' && t.nomeTerceiro !== fTercNome) return;
                if (fTercBanco !== 'Todos' && t.banco !== fTercBanco) return;

                const statusCompartilhado = t.terceiro?.tipo === 'usuario'
                    ? (t.terceiro.status || 'enviado')
                    : 'manual';
                const deveContabilizarTerceiro = statusCompartilhado === 'manual'
                    || statusCompartilhado === 'aceito'
                    || statusCompartilhado === 'pago';

                if (deveContabilizarTerceiro) {
                    totalTerceirosMes += val;
                }
                temGastoTerceiro = true;

                const tagTipoPC = t.tipo === 'cartao' 
                    ? `<span class="badge" style="background:${getCor(t.banco)}">${t.banco}</span>`
                    : `<span class="badge-tag">DÉBITO</span>`;

                // 👇 NOVA LÓGICA DE PARCELA INDIVIDUAL 👇
                const parcelaIndex = diff; // Sabe exatamente qual mês estamos olhando
                let estaParcelaPaga = false;
                
                if (typeof parcelaTerceiroRecebida === 'function') {
                    estaParcelaPaga = parcelaTerceiroRecebida(t, parcelaIndex);
                } else if (t.pagamentosParcelas && t.pagamentosParcelas[parcelaIndex] !== undefined) {
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
    atualizarCardCaixinhaDashboard();

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
            if(cardRes) {
                cardRes.classList.remove('mobile-subtab-active');
                cardRes.style.setProperty('display', 'none', 'important');
            }
            if(cardTer) {
                cardTer.classList.add('mobile-subtab-active');
                cardTer.style.setProperty('display', 'block', 'important');
            }
            if (typeof garantirTerceirosMobileVisivel === 'function') {
                garantirTerceirosMobileVisivel();
            }
        } else {
            if(cardRes) {
                cardRes.classList.add('mobile-subtab-active');
                cardRes.style.setProperty('display', 'block', 'important');
            }
            if(cardTer) {
                cardTer.classList.remove('mobile-subtab-active');
                cardTer.style.setProperty('display', 'none', 'important');
            }
        }
    }

    if (typeof renderizarDesejos === 'function') {
        renderizarDesejos();
    }

    atualizarPrimeirosPassosDashboard();
	
    atualizarGraficoMeta();

    if (typeof aplicarPrivacidadeValores === 'function') {
    requestAnimationFrame(aplicarPrivacidadeValores);
}

const main = document.querySelector('main');

if (main && main.classList.contains('calendar-mode')) {
    renderizarCalendarioFinanceiro(m, a);
}

if (main && main.classList.contains('visualizacoes-mode') && typeof renderizarVisualizacoes === 'function') {
    renderizarVisualizacoes();
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

    const btnSettings = document.getElementById('btn-view-settings');
    if (btnSettings) btnSettings.classList.remove('active');

    const mapaBotoes = {
        dashboard: 'btn-view-dashboard',
        calendario: 'btn-view-calendario',
        visualizacoes: 'btn-view-visualizacoes',
        settings: 'btn-view-settings'
    };

    const btn = document.getElementById(mapaBotoes[view] || 'btn-view-dashboard');

    if (btn) btn.classList.add('active');
}

function irParaDashboard() {
    if (typeof abrirDashboardFinanceira === 'function') {
        abrirDashboardFinanceira();
    }

    document.querySelectorAll('.tab-content').forEach(secao => {
        secao.classList.remove('active');
        secao.style.setProperty('display', 'none', 'important');
    });

    const isMobileDashboard = window.innerWidth <= 1024;
    const secoesDashboard = isMobileDashboard
        ? ['aba-home', 'aba-resumo-home']
        : ['aba-planejamento', 'aba-home', 'aba-fixos', 'aba-debito', 'aba-cartao', 'aba-resumo-home'];

    secoesDashboard.forEach(id => {
        const secao = document.getElementById(id);
        if (secao) {
            secao.classList.add('active');
            const display = !isMobileDashboard && id === 'aba-planejamento' ? 'flex' : 'block';
            secao.style.setProperty('display', display, 'important');
        }
    });

    const btnRes = document.getElementById('btn-show-resumo');
    const btnTer = document.getElementById('btn-show-terceiros');
    const cardRes = document.getElementById('card-resumo-conteudo');
    const cardTer = document.getElementById('card-terceiros');

    if (btnRes) btnRes.classList.add('active');
    if (btnTer) btnTer.classList.remove('active');
    if (cardRes) {
        cardRes.classList.add('mobile-subtab-active');
        cardRes.style.setProperty('display', 'block', 'important');
    }
    if (cardTer) {
        cardTer.classList.remove('mobile-subtab-active');
        if (isMobileDashboard) {
            cardTer.style.setProperty('display', 'none', 'important');
        } else {
            cardTer.style.setProperty('display', 'block', 'important');
        }
    }

    marcarViewSidebar('dashboard');

    if (typeof renderizar === 'function') {
        renderizar();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function ocultarAbasDashboardParaView() {
    document.querySelectorAll('.tab-content').forEach(secao => {
        secao.classList.remove('active');
        secao.style.setProperty('display', 'none', 'important');
    });
}

function irParaCalendario() {
    ocultarAbasDashboardParaView();

    marcarPrimeiroPassoDashboard('calendario');

    if (typeof abrirCalendarioFinanceiro === 'function') {
        abrirCalendarioFinanceiro();
    }

    marcarViewSidebar('calendario');
}

function irParaConfiguracoes(aba = 'perfil') {
    const main = document.querySelector('main');
    if (!main) return;

    document.querySelectorAll('.tab-content').forEach(secao => {
        secao.classList.remove('active');
        secao.style.setProperty('display', 'none', 'important');
    });

    main.classList.remove('calendar-mode');
    main.classList.remove('visualizacoes-mode');
    main.classList.add('settings-mode');

    marcarViewSidebar('settings');
    selecionarAbaConfiguracoes(aba);

    if (typeof carregarConfiguracoesPerfil === 'function') {
        carregarConfiguracoesPerfil();
    }

    const menuMob = document.getElementById('menu-dropdown');
    if (menuMob) menuMob.classList.remove('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function irParaVisualizacoes(aba = 'terceiros') {
    const main = document.querySelector('main');
    if (!main) return;

    marcarPrimeiroPassoDashboard('visualizacoes');

    ocultarAbasDashboardParaView();

    main.classList.remove('calendar-mode');
    main.classList.remove('settings-mode');
    main.classList.add('visualizacoes-mode');

    marcarViewSidebar('visualizacoes');
    selecionarAbaVisualizacoes(aba);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selecionarAbaVisualizacoes(aba = 'terceiros') {
    document.querySelectorAll('.visual-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.visualTab === aba);
    });

    document.querySelectorAll('.visual-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.visualPanel === aba);
    });

    if (typeof renderizarVisualizacoes === 'function') {
        renderizarVisualizacoes();
    }
}

function selecionarAbaConfiguracoes(aba = 'perfil') {
    document.querySelectorAll('.settings-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.settingsTab === aba);
    });

    document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.settingsPanel === aba);
    });

    if (aba === 'organizacao' && typeof renderizarConfiguracoesOrganizacao === 'function') {
        renderizarConfiguracoesOrganizacao();
    }
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

    const isDark = document.body.classList.contains('dark-theme');
    const cores = isDark
        ? ['#2ee889', '#04b965', '#1f7a57', '#65d6a2', '#1dbf86', '#8ee9bd', '#0f5f42', '#b7f4d0']
        : ['#025638', '#04b965', '#0a7c50', '#48dda4', '#19a66a', '#8de7b8', '#0f6d49', '#b9efd4'];

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
