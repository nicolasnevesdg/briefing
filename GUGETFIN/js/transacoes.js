function ajustarCamposModal() {
    const tipo = document.getElementById('g-tipo').value;
    
    const divForma = document.getElementById('div-forma-pagamento');
    if (divForma) {
        divForma.style.display = (tipo === 'debito') ? 'block' : 'none';
    }

    const campoForma = document.getElementById('g-forma-pagamento');
    const formaPag = campoForma ? campoForma.value : 'Débito';

    const divCartaoCampos = document.getElementById('div-cartao-campos');
    const inputParcelas = document.getElementById('g-parcelas');
    const selectBanco = document.getElementById('g-banco');

    if (divCartaoCampos) {
        if (tipo === 'debito' && formaPag === 'Dinheiro') {
            divCartaoCampos.style.display = 'none';
        } else {
            divCartaoCampos.style.display = window.innerWidth > 1024 ? 'grid' : 'flex';
            if (inputParcelas) inputParcelas.style.display = (tipo === 'cartao') ? '' : 'none';
            if (selectBanco) selectBanco.style.display = '';
        }
    }
    
    if (typeof atualizarListaBancos === 'function') atualizarListaBancos();
    
    // 👇 Nova linha que liga o Alerta Visual
    if (typeof atualizarAlertaFatura === 'function') atualizarAlertaFatura();
}

async function confirmarGasto() {
    let rawValue = document.getElementById('g-valor').value;
    const vTotal = parseFloat(rawValue.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    const tipo = document.getElementById('g-tipo').value; 
    const nParc = Math.max(1, parseInt(document.getElementById('g-parcelas').value) || 1);
    
    const campoForma = document.getElementById('g-forma-pagamento');
    const formaPag = campoForma ? campoForma.value : 'Débito';

    const indexEditEl = document.getElementById('g-index-edit');
    const indexEdit = indexEditEl ? parseInt(indexEditEl.value) : -1;

    // A variável TEM que existir fora do if
    let comprovanteUrl = indexEdit >= 0 && salsiData.transacoes[indexEdit].comprovanteUrl ? salsiData.transacoes[indexEdit].comprovanteUrl : "";

// 👇 ADICIONE ESTAS 3 LINHAS EXATAMENTE AQUI 👇
    if (document.getElementById('g-comprovante-apagado').value === "true") {
        comprovanteUrl = ""; 
    }

    const fileInput = document.getElementById('g-comprovante');

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        const btnSalvar = document.querySelector('#modal-gasto button[onclick="confirmarGasto()"]');
        const textoOriginal = btnSalvar.innerText;
        btnSalvar.innerText = "A subir nota... ⏳";
        btnSalvar.disabled = true;

        try {
            const apiKey = '9ce95a3c98b6a4e35865fb7cf8b535db'; 
            
            // 👇 1. A MÁGICA ACONTECE AQUI: Esmaga a imagem antes de enviar!
            const arquivoLeve = await comprimirImagem(file);
            
            const formData = new FormData();
            // 👇 2. Envia o 'arquivoLeve' em vez do arquivo pesado original
            formData.append('image', arquivoLeve); 

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                comprovanteUrl = data.data.url; 
            } else {
                throw new Error(data.error ? data.error.message : "Erro desconhecido na API");
            }

        } catch (error) {
            console.error("Erro fatal no upload:", error);
            alert("Erro ao enviar a imagem: " + error.message);
            return; // 🛑 Para a função aqui em caso de erro!
        } finally {
            btnSalvar.innerText = textoOriginal;
            btnSalvar.disabled = false;
        }
    }

const agoraCadastro = Date.now();
const tempoDestaqueNovo = 5 * 60 * 1000; // 5 minutos
const terceiroTipo = document.getElementById('g-terceiro-tipo')?.value || 'manual';
const terceiroUserId = document.getElementById('g-terceiro-user-id')?.value || '';
const terceiroUsername = document.getElementById('g-terceiro-username')?.value || '';
const nomeTerceiroValor = document.getElementById('g-nome-terceiro').value || "";

    // Monta o pacote de dados
    const novosDados = {
    nome: document.getElementById('g-nome').value,
    tipo: tipo,
    valorTotal: vTotal,
    valorParcela: vTotal / nParc,
    parcelas: nParc,
    dataCompra: document.getElementById('g-data').value,
    banco: document.getElementById('g-banco').value,
    categoria: document.getElementById('g-categoria').value,
    observacao: document.getElementById('g-observacao') ? document.getElementById('g-observacao').value.trim() : "",
    pago: false,
    delayPagamento: parseInt(document.getElementById('g-inicio-pagamento').value) || 0,
    eDeTerceiro: document.getElementById('g-terceiro').checked,
    nomeTerceiro: nomeTerceiroValor,
    terceiro: document.getElementById('g-terceiro').checked ? {
        tipo: terceiroTipo === 'usuario' && terceiroUserId ? 'usuario' : 'manual',
        nomeManual: terceiroTipo === 'usuario' && terceiroUsername ? `@${terceiroUsername}` : nomeTerceiroValor,
        userId: terceiroUserId,
        username: terceiroUsername,
        status: terceiroTipo === 'usuario' && terceiroUserId ? 'enviado' : 'local'
    } : null,
    formaPagamento: (tipo === 'debito') ? formaPag : null,
    comprovanteUrl: comprovanteUrl,

    criadoEm: indexEdit >= 0 ? (salsiData.transacoes[indexEdit].criadoEm || null) : agoraCadastro,
    destaqueAte: indexEdit >= 0 ? (salsiData.transacoes[indexEdit].destaqueAte || 0) : agoraCadastro + tempoDestaqueNovo
};

    if (indexEdit >= 0) {
        novosDados.pago = salsiData.transacoes[indexEdit].pago; 
        salsiData.transacoes[indexEdit] = novosDados;
        if (typeof mostrarToast === 'function') mostrarToast("Lançamento atualizado com sucesso!");
    } else {
        if (window.dividaEmPagamentoId) {
            novosDados.origemDividaCompartilhada = true;
            novosDados.dividaCompartilhadaId = window.dividaEmPagamentoId;
        }

        salsiData.transacoes.push(novosDados);
        if (novosDados.terceiro?.tipo === 'usuario' && typeof criarSolicitacaoGastoTerceiro === 'function') {
            await criarSolicitacaoGastoTerceiro(novosDados);
        }

        if (window.dividaEmPagamentoId && window.updateDoc && window.doc) {
            try {
                await window.updateDoc(window.doc(window.db, 'gastosCompartilhados', window.dividaEmPagamentoId), {
                    status: 'pago',
                    pagoPor: window.auth?.currentUser?.uid || '',
                    pagoPorTransacaoLocal: novosDados.criadoEm,
                    pagoEm: window.serverTimestamp ? window.serverTimestamp() : new Date().toISOString()
                });
            } catch (error) {
                console.error('Erro ao marcar dívida como paga:', error);
                if (typeof mostrarToast === 'function') mostrarToast('Gasto salvo, mas a dívida não foi marcada como paga.');
            } finally {
                window.dividaEmPagamentoId = null;
                window.dividaEmPagamentoDoc = null;
            }
        }

        if (typeof mostrarToast === 'function') mostrarToast("Lançamento salvo com sucesso! 💸");
    }
    
    renderizar(); 
    document.getElementById('modal-gasto').close();
}

function alternarStatusPago(index, parcelaIndex = null) {
    const gasto = salsiData.transacoes[index];
    
    // Se for um gasto parcelado (ex: de terceiro) e a função enviou o index da parcela
    if (parcelaIndex !== null && gasto.parcelas > 1) {
        // Compatibilidade com lançamentos antigos:
        // antes existia apenas o "pago" geral, então inicializamos todas as parcelas
        // com esse estado antes de inverter a parcela clicada.
        if (!gasto.pagamentosParcelas) {
            gasto.pagamentosParcelas = {};
            for (let i = 0; i < gasto.parcelas; i++) {
                gasto.pagamentosParcelas[i] = !!gasto.pago;
            }
        }
        
        // Lê o status atual dessa parcela (se não tiver, herda o antigo "pago" geral)
        let statusAtual = gasto.pagamentosParcelas[parcelaIndex];
        if (statusAtual === undefined) {
            statusAtual = !!gasto.pago; 
        }
        
        // Inverte APENAS o status desta parcela!
        gasto.pagamentosParcelas[parcelaIndex] = !statusAtual;
        gasto.pago = Object.values(gasto.pagamentosParcelas).filter(Boolean).length >= gasto.parcelas;
        
    } else {
        // Comportamento normal para Gastos Fixos (Não parcelados)
        gasto.pago = !gasto.pago; 

        // Lógica de Automação para o Mês Seguinte
        if (gasto.pago && gasto.tipo === 'fixo') {
            const dataAtual = new Date(gasto.dataCompra + "T00:00:00");
            
            const novaData = new Date(dataAtual);
            novaData.setMonth(novaData.getMonth() + 1);

            const dataFormatada = novaData.toISOString().split('T')[0];

            const jaExiste = salsiData.transacoes.some(t => 
                t.nome === gasto.nome && 
                t.dataCompra === dataFormatada && 
                t.tipo === 'fixo'
            );

            if (!jaExiste) {
                const novoGastoFixo = {
                    ...gasto,
                    dataCompra: dataFormatada,
                    pago: false
                };
                salsiData.transacoes.push(novoGastoFixo);
                console.log(`Agendado: ${gasto.nome} para o mês seguinte.`);
            }
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

async function confirmarEntrada() {
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

    const observacaoEntrada = document.getElementById('e-observacao')
    ? document.getElementById('e-observacao').value.trim()
    : "";
    
// 🚀 NOVO: Lógica de upload para as Entradas COM IMGBB E COMPRESSOR
    const fileInput = document.getElementById('e-comprovante');
    let comprovanteUrl = indexEdit === -1 ? "" : (salsiData.entradas[indexEdit].comprovanteUrl || "");

// 👇 A MÁGICA DA LIXEIRA AQUI 👇
    if (document.getElementById('e-comprovante-apagado').value === "true") {
        comprovanteUrl = ""; 
    }

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        const btnSalvar = document.querySelector('#modal-entrada button[onclick="confirmarEntrada()"]');
        const textoOriginal = btnSalvar.innerText;
        btnSalvar.innerText = "A subir comprovante... ⏳";
        btnSalvar.disabled = true;

        try {
            const apiKey = '9ce95a3c98b6a4e35865fb7cf8b535db'; 
            
            // 1. Esmaga a imagem primeiro!
            const arquivoLeve = await comprimirImagem(file);
            
            const formData = new FormData();
            formData.append('image', arquivoLeve); 

            // 2. Envia para o ImgBB
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                comprovanteUrl = data.data.url; 
            } else {
                throw new Error(data.error ? data.error.message : "Erro desconhecido na API");
            }

        } catch (error) {
            console.error("Erro fatal no upload da entrada:", error);
            alert("Erro ao enviar a imagem: " + error.message);
            return; // 🛑 Para a função aqui em caso de erro!
        } finally {
            btnSalvar.innerText = textoOriginal;
            btnSalvar.disabled = false;
        }
    }	

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
                observacao: observacaoEntrada,
                valor: valorPorParcela, 
                mes: dataParcela.getMonth(),
                ano: dataParcela.getFullYear(),
                dataRecebimento: dataParcela.toISOString().split('T')[0],
                projetoId: projetoId,
                valorTotalProjeto: valorDigitado,
                parcelaAtual: i + 1,
                totalParcelas: parcelas,
                comprovanteUrl: comprovanteUrl
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
		entradaEditada.comprovanteUrl = comprovanteUrl;
        entradaEditada.observacao = observacaoEntrada;

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

            parcelasDoProjeto.forEach(p => p.observacao = observacaoEntrada);

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
                        totalParcelas: parcelas,
						comprovanteUrl: comprovanteUrl // 🚀 NOVO
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

    const obsEntrada = document.getElementById('e-observacao');
    if (obsEntrada) obsEntrada.value = entrada.observacao || "";
    
    let mesStr = (entrada.mes + 1).toString().padStart(2, '0');
    document.getElementById('e-data').value = entrada.dataRecebimento || `${entrada.ano}-${mesStr}-01`;

    document.getElementById('e-categoria').value = entrada.categoria || "Projetos / Serviços";
    if (typeof ajustarCamposEntrada === 'function') ajustarCamposEntrada();
    
    // DESTRAVA AS PARCELAS
    const selectParcelas = document.getElementById('e-parcelas');
    if (entrada.projetoId && entrada.totalParcelas) {
        selectParcelas.value = entrada.totalParcelas.toString();
    }
	
	// 👇 A MÁGICA DOS BOTÕES NA EDIÇÃO AQUI 👇
    const entradaAtual = salsiData.entradas[index];
    setComprovanteUI('e', !!(entradaAtual.comprovanteUrl && entradaAtual.comprovanteUrl !== ""));

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

    const obsEntrada = document.getElementById('e-observacao');
    if (obsEntrada) obsEntrada.value = "";

    document.getElementById('e-data').value = "";
    document.getElementById('e-categoria').value = "Projetos / Serviços";
    document.getElementById('e-parcelas').value = "1";
	document.getElementById('e-comprovante').value = '';
	
	// 👇 ADICIONE A LINHA EXATAMENTE AQUI 👇
    setComprovanteUI('e', false);
	
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

    const blocoObsEnt = document.getElementById('det-ent-bloco-observacao');
    const textoObsEnt = document.getElementById('det-ent-observacao');

    if (blocoObsEnt && textoObsEnt) {
        if (e.observacao && e.observacao.trim() !== '') {
            blocoObsEnt.style.display = 'block';
            textoObsEnt.innerText = e.observacao;
        } else {
            blocoObsEnt.style.display = 'none';
            textoObsEnt.innerText = '';
        }
    }

// 🚀 NOVO: Controla a exibição do comprovante da entrada
    const blocoComp = document.getElementById('bloco-comprovante-entrada');
    const btnComp = document.getElementById('btn-ver-comprovante-entrada');

    if (blocoComp && btnComp) {
        if (e.comprovanteUrl) {
            blocoComp.style.display = 'block';
            btnComp.onclick = () => {
                document.getElementById('img-comprovante-preview').src = e.comprovanteUrl;
                document.getElementById('modal-ver-comprovante').showModal();
            };
        } else {
            blocoComp.style.display = 'none';
        }
    }

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
    window.dividaEmPagamentoId = null;
    window.dividaEmPagamentoDoc = null;

    popularSelects();
    
    // Define a data de hoje no formato YYYY-MM-DD
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('g-data').value = hoje;
    
    // Limpa todos os campos para um novo gasto
    document.getElementById('g-nome').value = '';
    document.getElementById('g-valor').value = '';

    const obsGasto = document.getElementById('g-observacao');
    if (obsGasto) obsGasto.value = '';

    document.getElementById('g-parcelas').value = 1;
    document.getElementById('g-tipo').value = 'cartao';
    document.getElementById('g-inicio-pagamento').value = '0';
	document.getElementById('g-comprovante').value = '';
	
	setComprovanteUI('g', false);
    
    const formaPag = document.getElementById('g-forma-pagamento');
    if(formaPag) formaPag.value = 'Débito';

    const checkTerceiro = document.getElementById('g-terceiro');
    if(checkTerceiro) checkTerceiro.checked = false;
    document.getElementById('g-nome-terceiro').value = '';
    if (document.getElementById('g-terceiro-user-id')) document.getElementById('g-terceiro-user-id').value = '';
    if (document.getElementById('g-terceiro-username')) document.getElementById('g-terceiro-username').value = '';
    if (document.getElementById('g-terceiro-tipo')) document.getElementById('g-terceiro-tipo').value = 'manual';
    if (document.getElementById('g-terceiro-sugestoes')) document.getElementById('g-terceiro-sugestoes').innerHTML = '';

    // Reseta o visual para Modo Criação
    const titulo = document.getElementById('modal-titulo');
    if (titulo) titulo.innerText = 'Novo Gasto 💸';
    
    // Reseta a memória invisível
    const indexEdit = document.getElementById('g-index-edit');
    if (indexEdit) indexEdit.value = '-1';
    
    if (typeof ajustarCamposModal === 'function') ajustarCamposModal();
    if (typeof toggleCampoNomeTerceiro === 'function') toggleCampoNomeTerceiro();
    
    document.getElementById('modal-gasto').showModal();
    focarCampoInicialModal('#g-nome');
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

    const obsGasto = document.getElementById('g-observacao');
    if (obsGasto) obsGasto.value = t.observacao || '';
    
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
    if (document.getElementById('g-terceiro-user-id')) document.getElementById('g-terceiro-user-id').value = t.terceiro?.userId || '';
    if (document.getElementById('g-terceiro-username')) document.getElementById('g-terceiro-username').value = t.terceiro?.username || '';
    if (document.getElementById('g-terceiro-tipo')) document.getElementById('g-terceiro-tipo').value = t.terceiro?.tipo || 'manual';
    if (document.getElementById('g-terceiro-sugestoes')) {
        document.getElementById('g-terceiro-sugestoes').innerHTML = t.terceiro?.username
            ? `<div class="terceiro-suggestion-selected">Vinculado a @${t.terceiro.username}</div>`
            : '';
    }

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

    if (typeof atualizarAlertaFatura === 'function') atualizarAlertaFatura();
	
	// 👇 COLE A LINHA DOS BOTÕES AQUI 👇
    setComprovanteUI('g', !!(t.comprovanteUrl && t.comprovanteUrl !== ""));

    document.getElementById('modal-gasto').showModal();
}

function abrirModalEntrada() {
    // Tenta limpar os dados antigos de forma segura
    if (typeof limparFormularioEntrada === 'function') {
        limparFormularioEntrada();
    }
    document.getElementById('modal-entrada').showModal();
    focarCampoInicialModal('#e-valor');
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

// ==========================================
// ALERTA INTELIGENTE DE FATURA
// ==========================================
function atualizarAlertaFatura() {
    const tipo = document.getElementById('g-tipo')?.value;
    const bancoSelecionado = document.getElementById('g-banco')?.value;
    const dataInput = document.getElementById('g-data')?.value;
    const inicioPagamento = parseInt(document.getElementById('g-inicio-pagamento')?.value) || 0;
    const alertaDiv = document.getElementById('alerta-fatura-cartao');

    if (!alertaDiv) return;

    // Só mostra se for crédito e tiver banco/data preenchidos
    if (tipo !== 'cartao' || !bancoSelecionado || !dataInput) {
        alertaDiv.style.display = 'none';
        return;
    }

    const detalhesBanco = salsiData.config.detalhesBancos?.find(b => b.nome === bancoSelecionado);

    // Se não tiver dados do cartão ou se for só débito, esconde
    if (!detalhesBanco || detalhesBanco.isDebitoOnly || !detalhesBanco.fechamento) {
        alertaDiv.style.display = 'none';
        return;
    }

    const fechamento = parseInt(detalhesBanco.fechamento);
    const vencimento = parseInt(detalhesBanco.vencimento);

    const dataCompra = new Date(dataInput + "T12:00:00");
const diaCompra = dataCompra.getDate();

/*
    IMPORTANTE:
    Não usamos new Date(dataCompra) + setMonth direto,
    porque 31/05 + 1 mês vira 01/07 no JavaScript.
    Então criamos a data sempre no dia 1.
*/
function criarMesAlvo(dataBase, mesesParaSomar = 0) {
    return new Date(
        dataBase.getFullYear(),
        dataBase.getMonth() + mesesParaSomar,
        1
    );
}

let mesAlvoDate = criarMesAlvo(dataCompra, 0);
let tipoAviso = "mes-atual";
let motivoAviso = "";

    // 1. Se o usuário forçou o pagamento para outro mês,
    // essa escolha manda mais do que o fechamento do cartão.
    if (inicioPagamento > 0) {
    mesAlvoDate = criarMesAlvo(dataCompra, inicioPagamento);
    tipoAviso = "forcado";

        if (inicioPagamento === 1) {
            motivoAviso = "porque você definiu a competência para o mês seguinte.";
        } else {
            motivoAviso = "porque você definiu a competência para daqui a 2 meses.";
        }
    }

    // 2. Se estiver no automático, aí sim usamos o fechamento do cartão.
    else {
        if (diaCompra > fechamento) {
    mesAlvoDate = criarMesAlvo(dataCompra, 1);
    tipoAviso = "virou-fatura";
    motivoAviso = `porque a compra foi feita no dia ${diaCompra}, depois do fechamento do cartão.`;
} else {
            tipoAviso = "mes-atual";
            motivoAviso = "porque a compra entra automaticamente no mês da compra.";
        }
    }

    const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

    const mesNome = meses[mesAlvoDate.getMonth()];
    const anoAlvo = mesAlvoDate.getFullYear();

    // Quantos dias faltam para o fechamento, em relação a hoje
    const hoje = new Date();
    const diaHoje = hoje.getDate();
    let textoDias = "";

    if (diaHoje < fechamento) {
        textoDias = `⏳ Faltam <strong>${fechamento - diaHoje} dias</strong> para o fechamento.`;
    } else if (diaHoje === fechamento) {
        textoDias = "🚨 A fatura <strong>fecha HOJE!</strong>";
    } else {
        textoDias = "🔒 A fatura deste mês já fechou.";
    }


    let classeAlerta = "is-warning";
    let iconeStatus = "🕒";
    let textoAlertaFinal = "";
    let alertaVisual = "";
    

    if (tipoAviso === "forcado") {
    classeAlerta = "is-info";
    textoAlertaFinal = `
        Esta compra será lançada na fatura de 
        <strong>${mesNome}/${anoAlvo}</strong>, ${motivoAviso}
    `;
} else if (tipoAviso === "virou-fatura") {
    classeAlerta = "is-success";
    textoAlertaFinal = `
        Esta compra será cobrada na fatura de 
        <strong>${mesNome}/${anoAlvo}</strong>, ${motivoAviso}
    `;
} else {
    classeAlerta = "is-warning";
    textoAlertaFinal = `
        Esta compra será cobrada na fatura de 
        <strong>${mesNome}/${anoAlvo}</strong>, ${motivoAviso}
    `;
}

if (diaHoje < fechamento) {
    iconeStatus = "⏳";
    textoDias = `Faltam <strong>${fechamento - diaHoje} dias</strong> para o fechamento.`;
} else if (diaHoje === fechamento) {
    iconeStatus = "🚨";
    textoDias = `A fatura <strong>fecha hoje</strong>.`;
} else {
    iconeStatus = "🔒";
    textoDias = `A fatura deste mês já fechou.`;
}


    alertaDiv.innerHTML = `
    <div class="fatura-preview-card">
        <div class="fatura-preview-topo">
            <div class="fatura-preview-meta">
                <span>Fechamento</span>
                <strong>Dia ${fechamento}</strong>
            </div>
            <div class="fatura-preview-meta">
                <span>Vencimento</span>
                <strong>Dia ${vencimento}</strong>
            </div>
        </div>

        <div class="fatura-preview-status">
            <span class="fatura-preview-status-icon">${iconeStatus}</span>
            <span>${textoDias}</span>
        </div>

        <div class="fatura-preview-alerta ${classeAlerta}">
            ${textoAlertaFinal}
        </div>
    </div>
`;

alertaDiv.style.display = 'block';
}

// Ouve as mudanças que o usuário faz e atualiza o alerta na mesma hora
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('g-banco')?.addEventListener('change', atualizarAlertaFatura);
    document.getElementById('g-data')?.addEventListener('change', atualizarAlertaFatura);
    document.getElementById('g-tipo')?.addEventListener('change', atualizarAlertaFatura);
    document.getElementById('g-inicio-pagamento')?.addEventListener('change', atualizarAlertaFatura);
});

