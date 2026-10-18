import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "./db";
import { getSettings } from "./settings";
import { STAGE_IDS, stageLabel } from "./constants";
import { addDays, formatDateTime, fromLocal, freeSlots, toLocalParts } from "./time";

const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 6;
const HISTORY_LIMIT = 40;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

// ---------------------------------------------------------------------------
// Ferramentas
// ---------------------------------------------------------------------------
const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "atualizar_lead",
    description:
      "Salva no CRM o que você descobriu sobre o cliente. Chame sempre que o cliente informar nome, serviço desejado, endereço/bairro, metragem ou outro detalhe útil, e para mudar a etapa do funil. Envie só os campos que mudaram.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome do cliente" },
        servico: { type: "string", description: "Serviço de interesse, ex.: Cerca elétrica, Concertina, Alambrado, Gradil, Portão automático, Manutenção" },
        endereco: { type: "string", description: "Endereço, bairro ou cidade do serviço" },
        metros: { type: "integer", description: "Metragem linear aproximada" },
        observacoes: { type: "string", description: "Detalhes relevantes: tipo de imóvel, altura do muro, prazo, etc." },
        etapa: { type: "string", enum: STAGE_IDS, description: "Etapa do funil: qualificado quando já se sabe serviço e local" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "ver_horarios_livres",
    description: "Lista os horários livres para visita técnica a partir de uma data (consulta os próximos dias úteis). Use antes de propor horários ao cliente.",
    input_schema: {
      type: "object",
      properties: { data: { type: "string", description: "Data inicial no formato AAAA-MM-DD" } },
      required: ["data"],
      additionalProperties: false,
    },
  },
  {
    name: "agendar_visita",
    description: "Agenda a visita técnica gratuita depois que o cliente confirmar data, horário e endereço. Só use horários retornados por ver_horarios_livres.",
    input_schema: {
      type: "object",
      properties: {
        inicio: { type: "string", description: "Data e hora local no formato AAAA-MM-DDTHH:MM" },
        endereco: { type: "string", description: "Endereço completo da visita" },
        observacoes: { type: "string" },
      },
      required: ["inicio", "endereco"],
      additionalProperties: false,
    },
  },
  {
    name: "transferir_para_humano",
    description:
      "Passa a conversa para um atendente da equipe e para de responder. Use quando o cliente pedir uma pessoa, reclamar, tratar de pagamento/financeiro, ou quando você não souber responder com segurança.",
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string", description: "Resumo curto do motivo, para a equipe" } },
      required: ["motivo"],
      additionalProperties: false,
    },
  },
];

const leadInput = z.object({
  nome: z.string().optional(),
  servico: z.string().optional(),
  endereco: z.string().optional(),
  metros: z.number().int().positive().optional(),
  observacoes: z.string().optional(),
  etapa: z.enum(STAGE_IDS).optional(),
});
const slotsInput = z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const scheduleInput = z.object({ inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), endereco: z.string().min(3), observacoes: z.string().optional() });
const handoffInput = z.object({ motivo: z.string() });

type ToolContext = { contactId: string; conversationId: string; handedOff: boolean };

async function runTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<string> {
  const settings = await getSettings();
  switch (name) {
    case "atualizar_lead": {
      const input = leadInput.parse(rawInput);
      const contact = await db.contact.findUniqueOrThrow({ where: { id: ctx.contactId } });
      const notes = input.observacoes ? [contact.notes, input.observacoes].filter(Boolean).join("\n") : undefined;
      await db.contact.update({
        where: { id: ctx.contactId },
        data: { name: input.nome, service: input.servico, address: input.endereco, meters: input.metros, notes, stage: input.etapa },
      });
      return "Lead atualizado.";
    }
    case "ver_horarios_livres": {
      const { data } = slotsInput.parse(rawInput);
      const today = toLocalParts(new Date()).date;
      let date = data < today ? today : data;
      const days: string[] = [];
      for (let i = 0; i < 14 && days.length < 4; i++, date = addDays(date, 1)) {
        const from = fromLocal(`${date}T00:00`);
        const busy = await db.appointment.findMany({
          where: { status: { not: "cancelada" }, start: { gte: from, lt: new Date(from.getTime() + 86_400_000) } },
          select: { start: true, durationMin: true },
        });
        const slots = freeSlots({ date, ...settings, busy });
        if (slots.length) days.push(`${date} (${formatDateTime(fromLocal(`${date}T12:00`)).split(",")[0]}): ${slots.join(", ")}`);
      }
      return days.length ? `Horários livres:\n${days.join("\n")}` : "Não há horários livres nos próximos 14 dias. Transfira para um atendente.";
    }
    case "agendar_visita": {
      const input = scheduleInput.parse(rawInput);
      const start = fromLocal(input.inicio);
      const { date, time } = toLocalParts(start);
      const from = fromLocal(`${date}T00:00`);
      const busy = await db.appointment.findMany({
        where: { status: { not: "cancelada" }, start: { gte: from, lt: new Date(from.getTime() + 86_400_000) } },
        select: { start: true, durationMin: true },
      });
      if (!freeSlots({ date, ...settings, busy }).includes(time)) {
        return "Esse horário não está disponível. Consulte ver_horarios_livres e ofereça outra opção.";
      }
      await db.appointment.create({
        data: { contactId: ctx.contactId, start, durationMin: settings.visitMinutes, address: input.endereco, notes: input.observacoes },
      });
      await db.contact.update({ where: { id: ctx.contactId }, data: { stage: "visita_agendada", address: input.endereco } });
      return `Visita agendada para ${formatDateTime(start)}. Confirme com o cliente e avise que ele receberá um lembrete na véspera.`;
    }
    case "transferir_para_humano": {
      const { motivo } = handoffInput.parse(rawInput);
      await db.conversation.update({ where: { id: ctx.conversationId }, data: { mode: "human", handoffReason: motivo } });
      ctx.handedOff = true;
      return "Conversa transferida. Avise o cliente que um atendente vai continuar em breve.";
    }
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
async function buildSystem(contactId: string): Promise<Anthropic.Beta.BetaTextBlockParam[]> {
  const settings = await getSettings();
  const contact = await db.contact.findUniqueOrThrow({ where: { id: contactId }, include: { appointments: { where: { status: "agendada" }, orderBy: { start: "asc" } } } });
  const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const workDays = settings.workDays.split(",").map((d) => days[Number(d)]).join(", ");

  const stable = `Você é ${settings.assistantName}, atendente da ${settings.companyName} no WhatsApp. Você conversa com clientes e potenciais clientes, tira dúvidas, qualifica o pedido e agenda visitas técnicas.

Estilo:
- Escreva como uma pessoa no WhatsApp: mensagens curtas (1 a 3 frases), simpáticas e em português do Brasil. Sem markdown, sem listas longas.
- Faça uma pergunta por vez.
- Use apenas as informações abaixo. Se não souber algo, diga que vai verificar com a equipe e transfira para um atendente.

Sobre a empresa:
${settings.knowledge}

Regras da empresa:
${settings.instructions}

Visitas técnicas: duram cerca de ${settings.visitMinutes} minutos, de ${workDays}, entre ${settings.workStart} e ${settings.workEnd}.

Ferramentas: registre no CRM tudo o que descobrir com atualizar_lead. Para agendar, consulte ver_horarios_livres, ofereça 2 ou 3 opções e, depois da confirmação do cliente e do endereço, use agendar_visita.`;

  const visits = contact.appointments.map((a) => formatDateTime(a.start)).join("; ");
  const now = new Date();
  const dynamic = `Agora: ${formatDateTime(now)} (hoje é ${toLocalParts(now).date}, horário de Brasília).
Dados do cliente no CRM: nome=${contact.name ?? "?"}; telefone=${contact.phone}; etapa=${stageLabel(contact.stage)}; serviço=${contact.service ?? "?"}; endereço=${contact.address ?? "?"}; metragem=${contact.meters ?? "?"}${visits ? `; visitas agendadas=${visits}` : ""}.`;

  return [
    { type: "text", text: stable, cache_control: { type: "ephemeral" } },
    { type: "text", text: dynamic },
  ];
}

async function buildHistory(conversationId: string): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const rows = await db.message.findMany({ where: { conversationId, role: { not: "system" } }, orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT });
  const messages: Anthropic.Beta.BetaMessageParam[] = rows
    .reverse()
    .map((m) => ({ role: m.role === "customer" ? "user" : "assistant", content: m.text }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  return messages;
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------
export type AgentResult = { reply: string | null; handedOff: boolean; error?: string };

export async function runAgent(conversationId: string): Promise<AgentResult> {
  const conversation = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  const ctx: ToolContext = { contactId: conversation.contactId, conversationId, handedOff: false };
  const system = await buildSystem(conversation.contactId);
  const messages = await buildHistory(conversationId);
  if (!messages.length) return { reply: null, handedOff: false };

  const texts: string[] = [];
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await getClient().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system,
        tools,
        messages,
      });

      if (response.stop_reason === "refusal") {
        await runTool("transferir_para_humano", { motivo: "A IA não pôde responder a esta mensagem." }, ctx);
        return { reply: "Vou chamar alguém da equipe para continuar seu atendimento, tudo bem? 😊", handedOff: true };
      }

      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text.trim())
        .filter(Boolean)
        .join("\n\n");
      if (text) texts.push(text);

      if (response.stop_reason !== "tool_use") break;

      messages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        try {
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: await runTool(block.name, block.input, ctx) });
        } catch (err) {
          const message = err instanceof z.ZodError ? `Parâmetros inválidos: ${err.message}` : String(err instanceof Error ? err.message : err);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: message, is_error: true });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
  } catch (err) {
    console.error("[agent]", err);
    const error =
      err instanceof Anthropic.AuthenticationError || (err instanceof Error && /api key|apiKey|authentication/i.test(err.message))
        ? "IA sem chave configurada (ANTHROPIC_API_KEY)."
        : err instanceof Anthropic.RateLimitError
          ? "Limite de uso da IA atingido. Tente novamente em instantes."
          : err instanceof Anthropic.APIError
            ? `Erro da IA (${err.status}).`
            : "Erro ao executar a IA.";
    return { reply: null, handedOff: ctx.handedOff, error };
  }

  return { reply: texts.at(-1) ?? null, handedOff: ctx.handedOff };
}
