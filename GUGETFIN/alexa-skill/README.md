# Skill GugetFin para Alexa

Esta pasta contém a Skill em português do Brasil e o backend para Alexa-hosted (Node.js).

## Fluxo

1. A pessoa abre o GugetFin na Alexa.
2. A Alexa pergunta se deseja cadastrar uma entrada ou uma saída.
3. O diálogo coleta os campos um por um e confirma o resumo.
4. A Skill envia o lançamento para a API oficial do GugetFin.

## Vinculação de conta

- Authorization URI: `https://nicolasneves.com.br/GUGETFIN/alexa-link.html`
- Access Token URI: `https://southamerica-east1-guget-fin.cloudfunctions.net/api/v1/oauth/token`
- Client ID: `gugetfin-alexa`
- Authentication Scheme: `HTTP Basic`
- Grant: `Authorization Code`
- PKCE: `S256`
- Scopes: `profile:read`, `transactions:read`, `transactions:write`

O Client Secret deve ser o mesmo configurado no Firebase Secret Manager em `ALEXA_OAUTH_CLIENT_SECRET`. Nunca salve esse segredo no repositório.

## Estrutura para importação

- `lambda/`: código executado pela Alexa.
- `skill-package/`: manifesto e modelo de interação `pt-BR`.
