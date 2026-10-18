# TOPCERCAS Atende

Atendimento com IA no WhatsApp da TOPCERCAS: a IA responde clientes, qualifica o pedido, agenda visitas técnicas e organiza os leads num CRM. A equipe acompanha tudo e assume a conversa quando quiser.

## Funcionalidades

- **IA atendente** (Claude): responde com base no que você cadastrar em *Configurar IA*, registra os dados do lead, consulta horários livres, agenda a visita e passa para um humano quando precisa.
- **Conversas**: todas as conversas em tempo real. Ao responder como atendente, a IA pausa naquela conversa; o botão *Devolver para a IA* reativa.
- **CRM**: funil em kanban (Novo → Qualificado → Visita agendada → Orçamento enviado → Fechado/Perdido). Arraste os cards ou edite a ficha do lead.
- **Agenda**: visitas marcadas pela IA ou pela equipe, com lembrete automático pelo WhatsApp 24h antes.
- **Simulador**: um "celular" para conversar como cliente e testar a IA sem conectar o WhatsApp.
- **Equipe e perfis**: cada pessoa entra com e-mail e senha próprios.
  - **Colaborador** vê as conversas livres (com a IA ou sem responsável) e as que ele assumiu. Ao responder ou clicar em *Assumir conversa*, ela passa a ser dele.
  - **Administrador** vê todas as conversas, inclusive as dos colaboradores, filtra por colaborador, transfere conversas e gerencia a equipe e a IA.
  - Cada mensagem enviada pela equipe guarda quem a escreveu.

## Rodando localmente

Requisitos: Node.js 20+.

```bash
npm install
npm run db:setup   # cria o banco SQLite (migrations) e os leads de exemplo
npm run dev
```

Acesse http://localhost:3000 e entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD` do arquivo `.env`. No primeiro login esse administrador é criado automaticamente; depois, crie os colaboradores em **Equipe**.

### Configuração (`.env`)

| Variável | Para quê |
|---|---|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Login do primeiro administrador (criado no primeiro acesso) |
| `AUTH_SECRET` | Segredo da sessão (32+ caracteres aleatórios) |
| `ANTHROPIC_API_KEY` | Chave da API do Claude — **sem ela a IA não responde** (crie em https://platform.claude.com) |
| `AI_MODEL` | Modelo da IA (padrão `claude-opus-5-5`) |
| `WHATSAPP_*` | WhatsApp Cloud API (opcional, veja abaixo) |

## Publicando no Railway

O app precisa de um servidor **sempre ligado** (lembretes a cada minuto, respostas da IA que levam alguns segundos e banco SQLite em disco). Por isso não serve hospedagem "serverless" como Netlify/Vercel.

1. Suba este projeto para um repositório **privado** no GitHub.
2. No Railway: *New Project → Deploy from GitHub repo* e escolha o repositório. O `railway.json` já define build e start.
3. Em *Settings → Volumes*, crie um volume montado em `/data` (é onde o banco fica salvo entre deploys).
4. Em *Variables*, cadastre:
   - `DATABASE_URL` = `file:/data/prod.db`
   - `AUTH_SECRET` (gere um novo, 32+ caracteres aleatórios), `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   - `ANTHROPIC_API_KEY`, `AI_MODEL`
   - as `WHATSAPP_*`, quando for conectar o WhatsApp
5. Em *Settings → Networking*, gere o domínio público ou ligue um seu (ex.: `atende.topcercas.com.br`).

A cada deploy, `npm run start:prod` aplica as migrations do banco e inicia o app. Mantenha **uma única instância**, porque os lembretes e a fila de cada conversa rodam na memória do servidor.

Mudou o `prisma/schema.prisma`? Rode `npm run db:migrate` localmente para gerar a migration e faça commit da pasta `prisma/migrations`.

## Conectando o WhatsApp oficial (Meta Cloud API)

1. Crie um app em https://developers.facebook.com/apps (tipo **Business**) e adicione o produto **WhatsApp**.
2. Cadastre e verifique o número da empresa. Copie o **Phone Number ID** e gere um **token permanente** (usuário do sistema no Business Manager).
3. Preencha no `.env`: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (chave secreta do app) e invente um `WHATSAPP_VERIFY_TOKEN`.
4. Publique o app num endereço HTTPS e configure o webhook em *WhatsApp → Configuração*: URL `https://SEU_DOMINIO/api/whatsapp/webhook`, token de verificação = `WHATSAPP_VERIFY_TOKEN`, campo assinado: `messages`.

A Meta cobra por conversa iniciada pela empresa; respostas dentro de 24h da mensagem do cliente seguem as regras de janela de atendimento. Mensagens fora dessa janela (como lembretes enviados muito depois da última mensagem do cliente) exigem **modelos de mensagem aprovados** — ainda não implementado.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/lib/agent.ts` | IA: prompt, ferramentas (atualizar lead, horários livres, agendar, transferir) e loop com o Claude |
| `src/lib/inbox.ts` | Recebe mensagens, aciona a IA e entrega as respostas pelo canal do contato |
| `src/lib/scheduler.ts` | Lembretes de visita (roda a cada minuto, iniciado em `src/instrumentation.ts`) |
| `src/app/api/whatsapp/webhook` | Webhook da Meta (com verificação de assinatura) |
| `src/app/(app)` | Telas: painel, conversas, CRM, agenda, simulador, configurações |
| `prisma/schema.prisma` | Banco de dados |

## Limitações desta versão

- Só texto: áudios, fotos e documentos do WhatsApp aparecem como aviso, sem transcrição.
- Lembretes fora da janela de 24h do WhatsApp precisam de modelo aprovado pela Meta.
- Colaboradores não recebem aviso automático quando uma conversa é transferida para eles (aparece na lista ao atualizar).
