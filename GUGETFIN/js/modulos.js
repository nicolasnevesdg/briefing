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

// ==========================================
// MÓDULO: MODO NOTURNO (DARK THEME)
// ==========================================

const TEMA_OVERRIDE_KEY = 'guget_tema_override_diario';
let temaSystemListenerRegistrado = false;
let temaScheduleTimer = null;

function obterDataLocalTema() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function obterConfigTemaConta() {
    if (!salsiData.config) salsiData.config = {};

    const temaManual = salsiData.config.temaManual || salsiData.config.tema || 'light';
    return {
        modo: salsiData.config.modoTema || 'manual',
        temaManual: temaManual === 'dark' ? 'dark' : 'light',
        inicio: salsiData.config.temaTurnoInicio || '18:00',
        fim: salsiData.config.temaTurnoFim || '06:00'
    };
}

function horaTemaParaMinutos(valor, fallback) {
    const partes = String(valor || fallback).split(':').map(Number);
    const horas = Number.isFinite(partes[0]) ? partes[0] : 0;
    const minutos = Number.isFinite(partes[1]) ? partes[1] : 0;
    return Math.max(0, Math.min(1439, horas * 60 + minutos));
}

function estaDentroDoTurnoNoturno(inicio, fim, agora = new Date()) {
    const atual = agora.getHours() * 60 + agora.getMinutes();
    const ini = horaTemaParaMinutos(inicio, '18:00');
    const end = horaTemaParaMinutos(fim, '06:00');

    if (ini === end) return true;
    if (ini < end) return atual >= ini && atual < end;
    return atual >= ini || atual < end;
}

function obterTemaSistema() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function obterOverrideTemaDiario() {
    try {
        const override = JSON.parse(localStorage.getItem(TEMA_OVERRIDE_KEY) || 'null');
        if (!override || override.data !== obterDataLocalTema()) {
            localStorage.removeItem(TEMA_OVERRIDE_KEY);
            return null;
        }
        return override.tema === 'dark' ? 'dark' : 'light';
    } catch (error) {
        localStorage.removeItem(TEMA_OVERRIDE_KEY);
        return null;
    }
}

function salvarOverrideTemaDiario(tema) {
    localStorage.setItem(TEMA_OVERRIDE_KEY, JSON.stringify({
        tema: tema === 'dark' ? 'dark' : 'light',
        data: obterDataLocalTema()
    }));
}

function limparOverrideTemaDiario() {
    localStorage.removeItem(TEMA_OVERRIDE_KEY);
}

function calcularTemaPreferido({ ignorarOverride = false } = {}) {
    const config = obterConfigTemaConta();

    if (!ignorarOverride && config.modo !== 'manual') {
        const override = obterOverrideTemaDiario();
        if (override) return override;
    }

    if (config.modo === 'system') return obterTemaSistema();
    if (config.modo === 'schedule') return estaDentroDoTurnoNoturno(config.inicio, config.fim) ? 'dark' : 'light';
    return config.temaManual;
}

function toggleTema(origemEl) {
    const toggleAntigo = document.getElementById('theme-toggle');
    const toggleNovo = document.getElementById('settings-theme-toggle');
    const origem = origemEl || toggleNovo || toggleAntigo;
    const isDark = origem ? origem.checked : !document.body.classList.contains('dark-theme');
    const tema = isDark ? 'dark' : 'light';
    const config = obterConfigTemaConta();

    if (config.modo === 'manual') {
        salvarTemaConta(isDark);
    } else {
        salvarOverrideTemaDiario(tema);
        aplicarTemaConta(isDark);
    }
}

function atualizarBotaoTemaTopo(isDark = document.body.classList.contains('dark-theme')) {
    const btn = document.getElementById('header-theme-toggle');
    if (!btn) return;

    btn.classList.toggle('is-dark', isDark);
    btn.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo noturno');
}

function alternarTemaTopo() {
    const isDark = !document.body.classList.contains('dark-theme');
    const config = obterConfigTemaConta();

    if (config.modo === 'manual') {
        salvarTemaConta(isDark);
    } else {
        salvarOverrideTemaDiario(isDark ? 'dark' : 'light');
        aplicarTemaConta(isDark);
    }
}

function aplicarTemaConta(isDark) {
    const toggleEl = document.getElementById('theme-toggle');
    const toggleNovo = document.getElementById('settings-theme-toggle');

    if (isDark) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }

    if (toggleEl) toggleEl.checked = isDark;
    if (toggleNovo) toggleNovo.checked = isDark;
    atualizarBotaoTemaTopo(isDark);
    atualizarInterfaceTemaSettings();

    setTimeout(() => {
        if (typeof atualizarGraficoAnual === 'function') atualizarGraficoAnual();
        if (typeof atualizarGraficoMeta === 'function') atualizarGraficoMeta();
    }, 100);
}

function salvarTemaConta(isDark) {
    if (!salsiData.config) salsiData.config = {};
    const tema = isDark ? 'dark' : 'light';
    salsiData.config.modoTema = 'manual';
    salsiData.config.temaManual = tema;
    salsiData.config.tema = tema;
    limparOverrideTemaDiario();
    localStorage.setItem('guget_tema_preferido', tema);
    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
    aplicarTemaConta(isDark);

    if (typeof salvarNoFirebase === 'function') salvarNoFirebase();
}

function carregarTemaPreferido() {
    const userLogado = !!(window.auth && window.auth.currentUser);
    const temaSalvo = userLogado ? calcularTemaPreferido() : 'light';

    localStorage.setItem('guget_tema_preferido', temaSalvo);
    aplicarTemaConta(temaSalvo === 'dark');
    configurarAtualizacaoAutomaticaTema();
}

function atualizarInterfaceTemaSettings() {
    const config = obterConfigTemaConta();
    const modeEl = document.getElementById('settings-theme-mode');
    const startEl = document.getElementById('settings-theme-start');
    const endEl = document.getElementById('settings-theme-end');
    const scheduleEl = document.getElementById('settings-theme-schedule');
    const manualEl = document.getElementById('settings-theme-manual-row');
    const noteEl = document.getElementById('settings-theme-note');

    if (modeEl && modeEl.value !== config.modo) modeEl.value = config.modo;
    if (startEl && startEl.value !== config.inicio) startEl.value = config.inicio;
    if (endEl && endEl.value !== config.fim) endEl.value = config.fim;

    if (scheduleEl) scheduleEl.style.display = config.modo === 'schedule' ? 'block' : 'none';
    if (manualEl) manualEl.style.display = config.modo === 'manual' ? 'flex' : 'none';

    if (noteEl) {
        if (config.modo === 'manual') {
            noteEl.textContent = 'No modo manual, o botão rápido altera e salva a aparência fixa da conta.';
        } else if (config.modo === 'system') {
            noteEl.textContent = 'O app segue o tema do dispositivo. O botão rápido vale como ajuste temporário até o próximo dia.';
        } else {
            noteEl.textContent = 'O app troca automaticamente conforme o intervalo definido. O botão rápido vale como ajuste temporário até o próximo dia.';
        }
    }
}

async function salvarPreferenciasTema() {
    if (!salsiData.config) salsiData.config = {};

    const modeEl = document.getElementById('settings-theme-mode');
    const toggleEl = document.getElementById('settings-theme-toggle');
    const startEl = document.getElementById('settings-theme-start');
    const endEl = document.getElementById('settings-theme-end');

    const modo = modeEl?.value || 'manual';
    const temaManual = toggleEl?.checked ? 'dark' : 'light';

    salsiData.config.modoTema = modo;
    salsiData.config.temaManual = temaManual;
    salsiData.config.temaTurnoInicio = startEl?.value || '18:00';
    salsiData.config.temaTurnoFim = endEl?.value || '06:00';
    limparOverrideTemaDiario();

    const temaEfetivo = calcularTemaPreferido({ ignorarOverride: true });
    salsiData.config.tema = temaEfetivo;
    localStorage.setItem('guget_tema_preferido', temaEfetivo);
    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));

    aplicarTemaConta(temaEfetivo === 'dark');
    configurarAtualizacaoAutomaticaTema();

    if (window.auth?.currentUser && window.updateDoc && window.doc) {
        try {
            await window.updateDoc(window.doc(window.db, 'usuarios', window.auth.currentUser.uid), {
                'dados.config.modoTema': salsiData.config.modoTema,
                'dados.config.temaManual': salsiData.config.temaManual,
                'dados.config.temaTurnoInicio': salsiData.config.temaTurnoInicio,
                'dados.config.temaTurnoFim': salsiData.config.temaTurnoFim,
                'dados.config.tema': salsiData.config.tema
            });
            return;
        } catch (error) {
            console.error('Erro ao salvar preferências de tema:', error);
        }
    }

    if (typeof salvarNoFirebase === 'function') await salvarNoFirebase();
}

function reavaliarTemaAutomatico() {
    if (!window.auth?.currentUser) return;
    const tema = calcularTemaPreferido();
    if (!salsiData.config) salsiData.config = {};
    salsiData.config.tema = tema;
    localStorage.setItem('guget_tema_preferido', tema);
    localStorage.setItem('salsifin_cache', JSON.stringify(salsiData));
    aplicarTemaConta(tema === 'dark');
}

function configurarAtualizacaoAutomaticaTema() {
    const config = obterConfigTemaConta();

    if (temaScheduleTimer) {
        clearInterval(temaScheduleTimer);
        temaScheduleTimer = null;
    }

    if (config.modo !== 'manual') {
        temaScheduleTimer = setInterval(reavaliarTemaAutomatico, 60000);
    }

    if (!temaSystemListenerRegistrado && window.matchMedia) {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = () => {
            if (obterConfigTemaConta().modo === 'system') reavaliarTemaAutomatico();
        };

        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', listener);
        } else if (typeof media.addListener === 'function') {
            media.addListener(listener);
        }

        temaSystemListenerRegistrado = true;
    }
}

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
    const dropdown = document.getElementById('dropdown-notificacoes');
    if (dropdown) dropdown.classList.toggle('active');
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

// ==========================================
// SISTEMA DE INDICAÇÃO (REFERRAL)
// ==========================================

function copiarLinkConvite() {
    const user = window.auth.currentUser; // Ajustado para usar o seu window.auth
    if (!user) return alert("Você precisa estar logado!");

    const linkConvite = `${window.location.origin}${window.location.pathname}?invite=${user.uid}`;

    navigator.clipboard.writeText(linkConvite).then(() => {
        if (typeof mostrarToast === 'function') mostrarToast("Link copiado! Envie para seus amigos. 🚀");
    }).catch(err => {
        alert("Copie este link: " + linkConvite);
    });
}

window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const codigoConvite = urlParams.get('invite');

    if (codigoConvite) {
        sessionStorage.setItem('referral_uid', codigoConvite);
        if(typeof mostrarFormulario === 'function') {
            mostrarFormulario('register');
        }
    }
});

// ==========================================
// COMPRESSOR DE IMAGENS AUTOMÁTICO
// ==========================================
function comprimirImagem(file, maxLargura = 1200, qualidade = 0.7) {
    return new Promise((resolve) => {
        // Se não for imagem (ex: PDF), devolve o arquivo original
        if (!file.type.startsWith('image/')) {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Redimensiona se for muito grande
                if (width > maxLargura) {
                    height = Math.round((height * maxLargura) / width);
                    width = maxLargura;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Converte de volta para arquivo, bem mais leve (JPEG)
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { 
                        type: 'image/jpeg', 
                        lastModified: Date.now() 
                    }));
                }, 'image/jpeg', qualidade);
            };
        };
    });
}

// ==========================================
// INTERFACE DE UPLOAD DE COMPROVANTES
// ==========================================
function setComprovanteUI(tipo, temAnexo) {
    const btnUpload = document.getElementById(`btn-custom-upload-${tipo}`);
    const btnTrash = document.getElementById(`btn-custom-trash-${tipo}`);
    const inputApagado = document.getElementById(`${tipo}-comprovante-apagado`);
    
    if (!btnUpload || !btnTrash) return;

    if (temAnexo) {
        // Estado: Com Arquivo
        btnUpload.innerHTML = '✓ Comprovante Anexado';
        btnUpload.style.background = '#d1fae5'; // Verde claro
        btnUpload.style.color = '#059669'; // Verde escuro
        
        btnTrash.style.background = '#fee2e2'; // Vermelho claro
        btnTrash.style.color = '#dc2626'; // Vermelho escuro
        btnTrash.disabled = false;
        btnTrash.style.cursor = 'pointer';
        
        if (inputApagado) inputApagado.value = 'false';
    } else {
        // Estado: Vazio
        btnUpload.innerHTML = '📎 Anexar Comprovante';
        btnUpload.style.background = '#e0f2fe'; // Azul claro
        btnUpload.style.color = '#0369a1'; // Azul escuro
        
        btnTrash.style.background = '#f3f4f6'; // Cinza
        btnTrash.style.color = '#9ca3af'; // Cinza escuro
        btnTrash.disabled = true;
        btnTrash.style.cursor = 'not-allowed';
    }
}

// Escuta quando o usuário escolhe um arquivo do celular/pc
document.getElementById('g-comprovante')?.addEventListener('change', function() {
    if (this.files.length > 0) setComprovanteUI('g', true);
});
document.getElementById('e-comprovante')?.addEventListener('change', function() {
    if (this.files.length > 0) setComprovanteUI('e', true);
});

// A função da Lixeira
window.removerAnexo = function(tipo) {
    if (confirm("Tem certeza que deseja apagar o comprovante deste lançamento?")) {
        document.getElementById(`${tipo}-comprovante`).value = ""; // Limpa o input invisível
        document.getElementById(`${tipo}-comprovante-apagado`).value = "true"; // Avisa o sistema para apagar do banco
        setComprovanteUI(tipo, false); // Volta os botões pra azul e cinza
    }
}

/* ========================================================= */
/* CALENDÁRIO FINANCEIRO - DESKTOP                           */
/* ========================================================= */

function abrirCalendarioFinanceiro() {
    const main = document.querySelector('main');
    if (!main) return;

    main.classList.remove('settings-mode');
    main.classList.remove('visualizacoes-mode');
    main.classList.add('calendar-mode');

    const mes = typeof m !== 'undefined' ? m : new Date().getMonth();
    const ano = typeof a !== 'undefined' ? a : new Date().getFullYear();

    renderizarCalendarioFinanceiro(mes, ano);
}

function abrirDashboardFinanceira() {
    const main = document.querySelector('main');
    if (!main) return;

    main.classList.remove('calendar-mode');
    main.classList.remove('settings-mode');
    main.classList.remove('visualizacoes-mode');
}

function formatarMoedaCalendario(valor) {
    return (valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

let filtroCalendarioFinanceiro = 'todos';
let calendarioTodosDiasAbertos = false;

function criarDataLocalCalendario(dataString) {
    if (!dataString) return null;
    return new Date(dataString + 'T12:00:00');
}

function gastoEhDeTerceiroCalendario(transacao) {
    return transacao?.eDeTerceiro === true || !!transacao?.nomeTerceiro || !!transacao?.terceiro;
}

function obterEntradasDoMesCalendario(mes, ano) {
    if (!salsiData || !Array.isArray(salsiData.entradas)) return [];

    return salsiData.entradas
        .map((entrada, index) => {
            const data = criarDataLocalCalendario(
                entrada.dataRecebimento ||
                entrada.data ||
                (Number.isInteger(entrada.ano) && Number.isInteger(entrada.mes)
                    ? `${entrada.ano}-${String(entrada.mes + 1).padStart(2, '0')}-01`
                    : '')
            );

            if (!data) return null;
            if (data.getMonth() !== mes || data.getFullYear() !== ano) return null;

            return {
                index,
                nome: entrada.nome || 'Entrada sem nome',
                valor: Number(entrada.valor || 0),
                banco: entrada.cliente || '',
                categoria: entrada.categoria || 'Entrada',
                data,
                dia: data.getDate(),
                tipo: 'entrada'
            };
        })
        .filter(Boolean);
}

function obterGastosDoMesCalendario(mes, ano, filtro = 'todos') {
    if (!Array.isArray(salsiData.transacoes)) return [];

    return salsiData.transacoes
        .map((t, index) => {
            const data = criarDataLocalCalendario(t.dataCompra);
            if (!data) return null;

            if (data.getMonth() !== mes || data.getFullYear() !== ano) return null;
            const isTerceiro = gastoEhDeTerceiroCalendario(t);

            if (filtro === 'terceiros' && !isTerceiro) return null;
            if (filtro === 'gastos' && isTerceiro) return null;
            if (filtro === 'entradas') return null;

            return {
                index,
                nome: t.nome || 'Gasto sem nome',
                valor: Number(t.valorParcela || t.valorTotal || 0),
                banco: t.banco || '',
                categoria: t.categoria || '',
                data,
                dia: data.getDate(),
                tipo: isTerceiro ? 'terceiro' : (t.tipo || 'gasto')
            };
        })
        .filter(Boolean);
}

function obterItensDoMesCalendario(mes, ano) {
    if (!salsiData) return [];
    const filtro = filtroCalendarioFinanceiro || 'todos';
    const entradas = filtro === 'todos' || filtro === 'entradas'
        ? obterEntradasDoMesCalendario(mes, ano)
        : [];
    const gastos = filtro === 'entradas'
        ? []
        : obterGastosDoMesCalendario(mes, ano, filtro);

    return [...gastos, ...entradas].sort((itemA, itemB) => {
        const dataDiff = itemA.data - itemB.data;
        if (dataDiff !== 0) return dataDiff;
        return String(itemA.nome || '').localeCompare(String(itemB.nome || ''), 'pt-BR');
    });
}

function obterMetaFiltroCalendario() {
    const metas = {
        todos: {
            titulo: 'Tudo',
            total: 'Total do período',
            mais: 'movimento',
            vazio: 'Nenhum movimento neste dia.'
        },
        gastos: {
            titulo: 'Gastos',
            total: 'Total de gastos',
            mais: 'gasto',
            vazio: 'Nenhum gasto neste dia.'
        },
        terceiros: {
            titulo: 'Gastos de terceiros',
            total: 'Total de terceiros',
            mais: 'gasto',
            vazio: 'Nenhum gasto de terceiro neste dia.'
        },
        entradas: {
            titulo: 'Entradas',
            total: 'Total de entradas',
            mais: 'entrada',
            vazio: 'Nenhuma entrada neste dia.'
        }
    };

    return metas[filtroCalendarioFinanceiro] || metas.todos;
}

function selecionarFiltroCalendario(filtro) {
    const filtrosValidos = ['todos', 'gastos', 'terceiros', 'entradas'];
    filtroCalendarioFinanceiro = filtrosValidos.includes(filtro) ? filtro : 'todos';
    calendarioTodosDiasAbertos = false;

    document.querySelectorAll('[data-calendar-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.calendarFilter === filtroCalendarioFinanceiro);
    });

    const mes = window.calendarioMesAtual ?? (typeof m !== 'undefined' ? m : new Date().getMonth());
    const ano = window.calendarioAnoAtual ?? (typeof a !== 'undefined' ? a : new Date().getFullYear());
    renderizarCalendarioFinanceiro(mes, ano);
}

function atualizarBotaoExpandirCalendario() {
    const btn = document.getElementById('calendar-expand-all-btn');
    if (!btn) return;

    btn.classList.toggle('active', calendarioTodosDiasAbertos);
    btn.innerHTML = calendarioTodosDiasAbertos
        ? '<i class="fi fi-rr-compress"></i><span>Recolher tudo</span>'
        : '<i class="fi fi-rr-expand"></i><span>Abrir tudo</span>';
}

function alternarTodosDiasCalendario() {
    calendarioTodosDiasAbertos = !calendarioTodosDiasAbertos;
    const mes = window.calendarioMesAtual ?? (typeof m !== 'undefined' ? m : new Date().getMonth());
    const ano = window.calendarioAnoAtual ?? (typeof a !== 'undefined' ? a : new Date().getFullYear());
    renderizarCalendarioFinanceiro(mes, ano);
}

function abrirItemCalendario(itemTipo, index) {
    if (itemTipo === 'entrada') {
        if (typeof verDetalhesEntrada === 'function') verDetalhesEntrada(index);
        return;
    }

    if (typeof verDetalhes === 'function') verDetalhes(index);
}

function renderizarCalendarioFinanceiro(mes, ano) {
    window.calendarioMesAtual = mes;
    window.calendarioAnoAtual = ano;
    const grid = document.getElementById('financial-calendar-grid');
    if (!grid) return;

    const nomesMeses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const title = document.getElementById('calendar-title');
    const metaFiltro = obterMetaFiltroCalendario();
    if (title) {
        title.textContent = `${metaFiltro.titulo} — ${nomesMeses[mes]} ${ano}`;
    }
    atualizarBotaoExpandirCalendario();

    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const totalDias = ultimoDia.getDate();
    const inicioSemana = primeiroDia.getDay();

    const itensCalendario = obterItensDoMesCalendario(mes, ano);

    const itensPorDia = {};
    itensCalendario.forEach(item => {
        if (!itensPorDia[item.dia]) itensPorDia[item.dia] = [];
        itensPorDia[item.dia].push(item);
    });

    const totalMes = itensCalendario.reduce((acc, item) => acc + item.valor, 0);
    const diasComMovimento = Object.keys(itensPorDia).length;

    const totalEl = document.getElementById('calendar-total-gastos');
    const totalLabelEl = document.getElementById('calendar-total-label');
    const diasEl = document.getElementById('calendar-dias-movimento');

    if (totalLabelEl) totalLabelEl.textContent = metaFiltro.total;
    if (totalEl) totalEl.textContent = formatarMoedaCalendario(totalMes);
    if (diasEl) diasEl.textContent = diasComMovimento;

    const hoje = new Date();
    const isMesAtual = hoje.getMonth() === mes && hoje.getFullYear() === ano;

    let html = '';

    for (let i = 0; i < inicioSemana; i++) {
        html += `<div class="calendar-day is-empty"></div>`;
    }

    for (let dia = 1; dia <= totalDias; dia++) {
        const itens = itensPorDia[dia] || [];
        const totalDia = itens.reduce((acc, item) => acc + item.valor, 0);
        const isToday = isMesAtual && hoje.getDate() === dia;

        const restante = itens.length > 3 ? itens.length - 3 : 0;

html += `
    <div 
        class="calendar-day ${isToday ? 'is-today' : ''} ${itens.length > 3 ? 'has-hidden-items' : ''} ${calendarioTodosDiasAbertos && itens.length > 3 ? 'is-expanded' : ''}"
        onclick="alternarDiaCalendario(event, this)"
        onmouseleave="programarFechamentoDiaCalendario(this)"
        onmouseenter="cancelarFechamentoDiaCalendario()"
    >
        <div class="calendar-day-header">
            <span class="calendar-day-number">${dia}</span>
            ${totalDia > 0 ? `<span class="calendar-day-total">${formatarMoedaCalendario(totalDia)}</span>` : ''}
        </div>

        <div class="calendar-items">
            ${itens.map((item, itemIndex) => `
                <div 
                    class="calendar-item calendar-item-${item.tipo} ${itemIndex >= 3 ? 'calendar-item-extra' : ''}" 
                    onclick="event.stopPropagation(); abrirItemCalendario('${item.tipo}', ${item.index})" 
                    title="${item.nome}"
                >
                    <span class="calendar-item-name">${item.nome}</span>
                    <span class="calendar-item-value">${formatarMoedaCalendario(item.valor)}</span>
                </div>
            `).join('')}

            ${restante > 0 ? `<button type="button" class="calendar-more" onclick="event.stopPropagation(); alternarDiaCalendario(event, this.closest('.calendar-day'))">+${restante} ${metaFiltro.mais}${restante > 1 ? 's' : ''}</button>` : ''}
        </div>
    </div>
`;
    }

    grid.innerHTML = html;
}

/* ========================================================= */
/* CALENDÁRIO - EXPANDIR DIA                                 */
/* ========================================================= */

let timerFecharDiaCalendario = null;

function fecharDiaCalendario() {
    if (calendarioTodosDiasAbertos) return;

    document.querySelectorAll('.calendar-day.is-expanded').forEach(day => {
        day.classList.remove('is-expanded');
    });
}

function alternarDiaCalendario(event, dayElement) {
    if (!dayElement || !dayElement.classList.contains('calendar-day')) return;
    if (calendarioTodosDiasAbertos) return;

    const temItensOcultos = dayElement.classList.contains('has-hidden-items');
    if (!temItensOcultos) return;

    const jaAberto = dayElement.classList.contains('is-expanded');

    fecharDiaCalendario();

    if (!jaAberto) {
        dayElement.classList.add('is-expanded');
    }
}

function programarFechamentoDiaCalendario(dayElement) {
    if (calendarioTodosDiasAbertos) return;
    if (!dayElement || !dayElement.classList.contains('is-expanded')) return;

    cancelarFechamentoDiaCalendario();

    timerFecharDiaCalendario = setTimeout(() => {
        dayElement.classList.remove('is-expanded');
    }, 5000);
}

function cancelarFechamentoDiaCalendario() {
    if (timerFecharDiaCalendario) {
        clearTimeout(timerFecharDiaCalendario);
        timerFecharDiaCalendario = null;
    }
}

document.addEventListener('click', function(event) {
    if (calendarioTodosDiasAbertos) return;
    const clicouEmDia = event.target.closest('.calendar-day');

    if (!clicouEmDia) {
        fecharDiaCalendario();
    }
});
