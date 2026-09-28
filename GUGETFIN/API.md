# API GugetFin v1

A API permite que relógios, atalhos, aplicativos e a Skill da Alexa usem a mesma conta do GugetFin sem acessar o Firestore diretamente. Ela não realiza conexão bancária e não usa Open Finance.

## Endereço

Após publicar a função `api` no projeto Firebase `guget-fin`:

```text
https://southamerica-east1-guget-fin.cloudfunctions.net/api/v1
```

## Autenticação

Use uma chave criada em **Configurações → Integrações**:

```http
Authorization: Bearer ggf_live_...
```

A chave aparece uma única vez. Apenas o hash é guardado no Firestore. Cada dispositivo possui sua própria chave e pode ser revogado sem trocar a senha da conta.

## Rotas

### Testar disponibilidade

```http
GET /health
```

### Identificar a conta

```http
GET /me
```

### Listar categorias

```http
GET /categories
```

### Listar cartões e contas

```http
GET /accounts
```

### Listar lançamentos recentes

```http
GET /transactions?limit=25
```

### Resumo mensal para relógios

```http
GET /watch/summary?month=2026-09
```

Também aceita `month=09&year=2026`. Sem parâmetros, usa o mês atual no horário de São Paulo.

A resposta usa os mesmos critérios do painel: competência da fatura para compras no crédito, somente gastos fixos pagos, gastos de terceiros separados do saldo e resgates de caixinha contabilizados como entrada. Ela também devolve o saldo total e a lista das caixinhas.

```json
{
  "success": true,
  "data": {
    "period": "2026-09",
    "balance": 65.62,
    "income": 1926.55,
    "expenses": 1860.93,
    "cardTotal": 1280.40,
    "incomePercentage": 96.6,
    "savings": {
      "total": 850,
      "monthlyMovement": 100,
      "count": 2,
      "boxes": []
    }
  }
}
```

### Cadastrar saída

```http
POST /transactions
Content-Type: application/json
Idempotency-Key: identificador-unico-do-dispositivo
```

```json
{
  "type": "expense",
  "name": "Mercado",
  "amount": 125.50,
  "date": "2026-09-20",
  "paymentMethod": "credit",
  "account": "Nubank",
  "category": "Mercado",
  "installments": 2,
  "description": "Compra da semana"
}
```

Formas de pagamento aceitas: `credit`, `debit`, `pix`, `cash` e `fixed`.

### Cadastrar entrada

```json
{
  "type": "income",
  "name": "Freelance",
  "amount": 500,
  "date": "2026-09-20",
  "category": "Renda Extra",
  "source": "Cliente X",
  "description": "Identidade visual"
}
```

### Desfazer lançamento criado pela API

```http
DELETE /transactions/{id}
```

A API não exclui lançamentos criados manualmente pelo site.

## Alexa

A Skill usa OAuth 2.0 Authorization Code com PKCE. A pessoa entra na própria conta pela página oficial do GugetFin, autoriza a Skill e pode revogar o acesso em **Configurações → Integrações**.

```text
Authorization URI
https://nicolasneves.com.br/GUGETFIN/alexa-link.html

Access Token URI
https://southamerica-east1-guget-fin.cloudfunctions.net/api/v1/oauth/token

Client ID
gugetfin-alexa
```

Rotas internas da vinculação:

```http
POST /oauth/authorize
POST /oauth/token
```

O endpoint de autorização exige uma sessão Firebase válida. O endpoint de token aceita somente a Amazon autenticada pelo segredo guardado no Firebase Secret Manager.

## WhatsApp

O WhatsApp usa o mesmo serviço para consultar as opções da conta e cadastrar lançamentos. A conversa coleta uma informação por vez, mostra um resumo e só grava depois da confirmação.

As escolhas fechadas usam componentes interativos nativos do WhatsApp: botões para entrada/saída, data, descrição e confirmação; listas para forma de pagamento, contas, cartões e categorias. Nome, valor, parcelas, data personalizada e descrição continuam sendo digitados. Todas as etapas também aceitam texto como alternativa.

```text
Callback URL
https://southamerica-east1-guget-fin.cloudfunctions.net/api/v1/whatsapp/webhook

Página de vinculação
https://nicolasneves.com.br/GUGETFIN/whatsapp-link.html
```

Rotas internas:

```http
GET  /whatsapp/webhook
POST /whatsapp/webhook
POST /whatsapp/link
GET  /whatsapp/status
DELETE /whatsapp/connection
```

Depois da vinculação, o WhatsApp aparece em **Configurações → Integrações** com o número mascarado. A pessoa pode desconectá-lo por ali; a revogação remove o vínculo e a conversa em andamento imediatamente, sem apagar lançamentos já cadastrados.

O webhook valida a assinatura `X-Hub-Signature-256`, ignora mensagens repetidas e não registra o texto recebido nos logs. O link de vinculação expira em 15 minutos e só pode ser usado uma vez.

## Segurança

- O token completo nunca é armazenado.
- Cartões e categorias são validados contra os dados da conta.
- `Idempotency-Key` impede duplicação quando um dispositivo repete a mesma requisição.
- Cada alteração gera um registro de auditoria.
- Chaves podem ser revogadas individualmente.
- Tokens da Alexa expiram em uma hora e são renovados por um refresh token revogável.
- Códigos de autorização da Alexa expiram em cinco minutos e só podem ser usados uma vez.
- A vinculação aceita apenas os endereços oficiais de retorno da Alexa.
- Mensagens do WhatsApp são aceitas somente quando assinadas pelo app oficial da Meta.
- Um lançamento recebido pelo WhatsApp só é gravado depois de a pessoa responder `confirmar`.
- Rotas de criação e revogação de chaves exigem uma sessão Firebase válida do site.

## Publicação

```powershell
npm install --prefix functions
npx firebase-tools login
npx firebase-tools deploy --only functions:api --project guget-fin
```

O projeto Firebase precisa permitir Cloud Functions de segunda geração. Antes de publicar, confirme o plano e o faturamento no console do Firebase.
