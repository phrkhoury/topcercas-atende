import { db } from "./db";

export type StageInfo = { id: string; name: string; color: string; isVisit: boolean };

/** Cores oferecidas ao criar/editar etapas. */
export const STAGE_COLORS = ["#94a3b8", "#0ea5e9", "#f59e0b", "#8b5cf6", "#10b981", "#f43f5e", "#ec4899", "#14b8a6", "#eab308", "#6366f1"];

const DEFAULT_STAGES: StageInfo[] = [
  { id: "novo", name: "Novo", color: "#94a3b8", isVisit: false },
  { id: "qualificado", name: "Qualificado", color: "#0ea5e9", isVisit: false },
  { id: "visita_agendada", name: "Visita agendada", color: "#f59e0b", isVisit: true },
  { id: "orcamento", name: "Orçamento enviado", color: "#8b5cf6", isVisit: false },
  { id: "fechado", name: "Fechado", color: "#10b981", isVisit: false },
  { id: "perdido", name: "Perdido", color: "#f43f5e", isVisit: false },
];

/** Etapas do funil na ordem do CRM. Recria as padrão se a tabela estiver vazia. */
export async function getStages(): Promise<StageInfo[]> {
  const stages = await db.stage.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true, color: true, isVisit: true } });
  if (stages.length) return stages;
  await db.stage.createMany({ data: DEFAULT_STAGES.map((s, i) => ({ ...s, position: i + 1 })) });
  return DEFAULT_STAGES;
}

/** Etapa onde entram os contatos novos (a primeira do funil). */
export async function firstStageId() {
  return (await getStages())[0].id;
}

/** Etapa para onde o lead vai quando uma visita é agendada (se existir). */
export async function visitStageId() {
  return (await getStages()).find((s) => s.isVisit)?.id ?? null;
}

export async function stageExists(id: string) {
  return Boolean(await db.stage.findUnique({ where: { id }, select: { id: true } }));
}

export const stageName = (stages: StageInfo[], id: string) => stages.find((s) => s.id === id)?.name ?? "Sem etapa";
export const stageColor = (stages: StageInfo[], id: string) => stages.find((s) => s.id === id)?.color ?? "#94a3b8";
