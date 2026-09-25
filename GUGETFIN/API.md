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
https://www.nicolasneves.com.br/alexa-link.html

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

## Segurança

- O token completo nunca é armazenado.
- Cartões e categorias são validados contra os dados da conta.
- `Idempotency-Key` impede duplicação quando um dispositivo repete a mesma requisição.
- Cada alteração gera um registro de auditoria.
- Chaves podem ser revogadas individualmente.
- Tokens da Alexa expiram em uma hora e são renovados por um refresh token revogável.
- Códigos de autorização da Alexa expiram em cinco minutos e só podem ser usados uma vez.
- A vinculação aceita apenas os endereços oficiais de retorno da Alexa.
- Rotas de criação e revogação de chaves exigem uma sessão Firebase válida do site.

## Publicação

```powershell
npm install --prefix functions
npx firebase-tools login
npx firebase-tools deploy --only functions:api --project guget-fin
```

O projeto Firebase precisa permitir Cloud Functions de segunda geração. Antes de publicar, confirme o plano e o faturamento no console do Firebase.
