# Just Já — Plataforma de antecipação de pequenas causas cíveis (MVP B2C)

Site estático (HTML + CSS + JS vanilla) com **autenticação real via Supabase**.
Apresenta a plataforma, captação de leads e simulação da jornada completa
de antecipação de processo judicial pela ótica do **cliente final** (pessoa física).

> **Versão atual:** v0.3 — auth real (Supabase), dados de processos ainda em
> `localStorage` (cada usuário só vê os seus na máquina dele).
>
> A pasta do projeto se chama `strategi-site/` por motivos históricos; o produto é **Just Já**.

---

## 1. Setup rápido (antes de qualquer coisa)

### 1.1 Preencher credenciais Supabase

Abra `assets/js/config.js` e cole:

```js
window.JUSTJA_CONFIG = {
  SUPABASE_URL:      "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...",
};
```

**Onde encontrar:** painel Supabase → `Settings → API`.
- **Project URL** → vai em `SUPABASE_URL`
- **Project API keys → anon public** → vai em `SUPABASE_ANON_KEY`

⚠️ NUNCA cole a `service_role key` aqui — essa é secreta, só backend.

### 1.2 Ajustar o Auth do Supabase

No painel Supabase → `Authentication → Providers → Email`:
- **Confirm email:** desligado (pra MVP — fluxo direto). Religar antes de produção.
- **Allow new users to sign up:** ligado durante validação; desligar quando quiser fechar.

### 1.3 Rodar localmente

```bash
cd strategi-site
python -m http.server 8000   # ou: npx serve .
# Abrir http://localhost:8000
```

## 2. Estrutura

```
strategi-site/
├── index.html              # Landing pública
├── login.html              # Login (Supabase Auth)
├── cadastro.html           # Cadastro (Supabase Auth)
├── privacidade.html        # Política preliminar
├── app/
│   ├── dashboard.html      # Painel do cliente
│   ├── novo-processo.html  # Cria proc e redireciona p/ jornada
│   └── jornada.html        # 6 estágios da antecipação
├── assets/
│   ├── css/styles.css
│   └── js/
│       ├── config.js       # ⚠️ PREENCHER com URL + anon key do Supabase
│       ├── auth.js         # Auth via @supabase/supabase-js (CDN)
│       ├── app.js          # Utils + storage local de processos
│       ├── simulador.js    # Motor de pricing placeholder
│       ├── jornada.js      # Render dos 6 estágios + tribunais
│       ├── chat.js         # Widget flutuante (Cloudflare Worker)
│       └── gate.js         # Portão de senha JS (não usado — fallback)
├── cloudflare-worker.js    # Código do proxy do chat → Claude API
└── README.md
```

## 3. Os 6 estágios da jornada

1. **Cadastro** — apelido, tipo (cível), tribunal/vara (dropdown JEC + outros), valor, descrição
2. **Consulta e Análise** — autorização + CNJ → DJEN/DataJud (mock) + IA. Pode ser síncrona ou assíncrona
3. **Oferta** — proposta com escolha integral × só a parte do cliente (honorários do advogado)
4. **Assinatura** — contrato de cessão + termo de cessão para os autos
5. **Protocolação** — cliente/advogado protocolam e enviam comprovante
6. **Pagamento** — após validação do comprovante, PIX (status "no carrinho" → "pago")

## 4. Escopo: pequenas causas cíveis

- **Direito Aéreo** — voo cancelado, atraso, bagagem extraviada
- **Consumidor** — cobrança indevida, defeito de produto, serviço não prestado
- **Bancário** — tarifas indevidas, juros abusivos, fraude
- **Outras relações de consumo** — plano de saúde, telefonia, internet, energia

## 5. Status atual: mock vs. produção

| Componente | Hoje | Produção |
|---|---|---|
| **Autenticação** | ✅ Supabase Auth (real) | mantém |
| **Persistência de processos** | `localStorage` (por browser) | Supabase Postgres (15 tabelas do brief) |
| Consulta DJEN/DataJud | mock | API route server-side |
| Análise por IA | mock | Claude lendo dados públicos |
| Pricing | tabela hard-coded em `simulador.js` | Motor externo |
| Tribunais | lista placeholder em `jornada.js` | Catálogo CNJ completo |
| Assinatura | checkbox + nome | Clicksign / D4Sign + ICP-Brasil |
| Termo de cessão | gerado conforme escolha integral × parcial | Template oficial preenchido server-side |
| Upload de protocolação | só metadados | Supabase Storage + OCR |
| Pagamento | botão demo | PIX via PSP |
| **Chat** | widget pronto, hookup Worker + Claude | mesmo, com tracking |

## 6. Deploy no Vercel

### 6.1 Via dashboard (drag-and-drop)

1. https://vercel.com → Login (Google/GitHub serve)
2. **"Add New" → "Project"** → arrasta a pasta `strategi-site/` em cima
3. Em "Framework Preset" escolhe **"Other"** (é HTML estático)
4. Clica **"Deploy"**
5. Em ~30s sai a URL `https://nome-do-projeto.vercel.app`

### 6.2 Via CLI

```powershell
npm install -g vercel
cd C:\Users\timmi\Desktop\strategi-site
vercel
# aceita os defaults: nome, dir = "./", framework = "Other"
```

### 6.3 Pra mostrar pro sócio (fluxo recomendado)

- Faz deploy no Vercel (acima)
- Manda a URL pro seu sócio
- Ele entra em `/cadastro.html`, cria conta com e-mail dele
- Como "Confirm email" está desligado, já cai no dashboard
- Pra fechar pra estranhos depois: desliga "Allow new users to sign up" no painel Supabase

## 7. Chat com IA (opcional)

Arquivo `cloudflare-worker.js` na raiz tem o código do proxy que conecta o widget de chat ao Claude. Setup descrito no próprio arquivo (~5 passos no painel Cloudflare). Custa ~$0.25 por milhão de tokens com Haiku — muito barato pra MVP.

Em `assets/js/chat.js` a URL já tá apontando pra `https://justja-chat.timbere-nog.workers.dev` — quando o Worker estiver com o código real + chave, o chat passa a usar Claude. Enquanto isso, cai em respostas canned.

## 8. Avisos de segurança

- **Auth:** já é real (Supabase). 👍
- **Anon key exposta:** OK, é projetada pra isso. Quem controla acesso é o RLS do Postgres.
- **Dados de processos:** ainda só no `localStorage` — perde se limpar cache. Migrar pra Supabase Postgres é o próximo passo.
- **Service_role key:** NÃO existe nesse projeto. Se um dia precisar, vai em variável de ambiente do backend, NUNCA no JS do browser.
- **Tela de assinatura:** apenas demo (checkbox + nome). Produção precisa de Clicksign/D4Sign com ICP-Brasil.
- **PIX:** apenas mock. Produção precisa de integração com PSP.

## 9. Próximos passos sugeridos

- [ ] Persistir processos em Supabase Postgres com RLS por usuário
- [ ] Integração DJEN/DataJud (API route Vercel ou Edge Function Supabase)
- [ ] Motor de score/pricing real
- [ ] Análise por LLM (Claude via Worker já existe)
- [ ] Geração automática do termo de cessão (templates integral × parcial)
- [ ] Assinatura digital (Clicksign/D4Sign)
- [ ] PIX (PSP)
- [ ] Dashboard interno do backoffice
