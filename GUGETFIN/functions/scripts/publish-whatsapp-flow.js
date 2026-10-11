const fs = require('node:fs/promises');
const path = require('node:path');

const GRAPH_VERSION = 'v26.0';
const WABA_ID = '2907446746254565';
const ACCESS_TOKEN = String(process.env.GUGETFIN_WHATSAPP_ACCESS_TOKEN || '').trim();
const FLOWS = [
    { name: 'gugetfin_cadastro_v1', file: 'gugetfin-expense.json' },
    { name: 'gugetfin_entrada_v1', file: 'gugetfin-income.json' }
];

if (!ACCESS_TOKEN) throw new Error('GUGETFIN_WHATSAPP_ACCESS_TOKEN não foi informado.');

async function graph(caminho, opcoes = {}) {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${caminho}`, {
        ...opcoes,
        headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            ...(opcoes.headers || {})
        }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const erro = new Error(body?.error?.message || `Graph API respondeu ${response.status}.`);
        erro.details = body?.error?.error_data?.details || body?.error?.code || response.status;
        throw erro;
    }
    return body;
}

async function localizarOuCriarFlow(flowDefinition, lista) {
    const existente = (lista.data || []).find(item => item.name === flowDefinition.name);
    if (existente) return existente;

    const body = new URLSearchParams({
        name: flowDefinition.name,
        categories: JSON.stringify(['OTHER'])
    });
    return graph(`${WABA_ID}/flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });
}

async function enviarJson(flowId, arquivo) {
    const caminho = path.resolve(__dirname, '..', 'whatsapp-flow', arquivo);
    const conteudo = await fs.readFile(caminho);
    const body = new FormData();
    body.set('name', 'flow.json');
    body.set('asset_type', 'FLOW_JSON');
    body.set('file', new Blob([conteudo], { type: 'application/json' }), arquivo);
    return graph(`${flowId}/assets`, { method: 'POST', body });
}

async function main() {
    const lista = await graph(`${WABA_ID}/flows?fields=id,name,status&limit=100`);
    const publicados = [];
    for (const flowDefinition of FLOWS) {
        const flow = await localizarOuCriarFlow(flowDefinition, lista);
        let status = flow.status || 'DRAFT';
        if (status !== 'PUBLISHED') {
            await enviarJson(flow.id, flowDefinition.file);
            const validacao = await graph(`${flow.id}?fields=id,name,status,validation_errors`);
            if (Array.isArray(validacao.validation_errors) && validacao.validation_errors.length) {
                process.stdout.write(`${JSON.stringify({ id: flow.id, status: validacao.status, validationErrors: validacao.validation_errors }, null, 2)}\n`);
                process.exitCode = 2;
                return;
            }
            await graph(`${flow.id}/publish`, { method: 'POST' });
            status = 'PUBLISHED';
        }
        publicados.push({ id: String(flow.id), name: flowDefinition.name, status });
    }
    process.stdout.write(`${JSON.stringify(publicados, null, 2)}\n`);
}

main().catch(error => {
    process.stderr.write(`Falha ao publicar o Flow: ${error.message}\n`);
    if (error.details) process.stderr.write(`Detalhes: ${JSON.stringify(error.details)}\n`);
    process.exitCode = 1;
});
