export const STAGES = [
  { id: "novo", label: "Novo", color: "bg-slate-400" },
  { id: "qualificado", label: "Qualificado", color: "bg-sky-500" },
  { id: "visita_agendada", label: "Visita agendada", color: "bg-amber-500" },
  { id: "orcamento", label: "Orçamento enviado", color: "bg-violet-500" },
  { id: "fechado", label: "Fechado", color: "bg-emerald-500" },
  { id: "perdido", label: "Perdido", color: "bg-rose-500" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];
export const STAGE_IDS = STAGES.map((s) => s.id) as [StageId, ...StageId[]];
export const stageLabel = (id: string) => STAGES.find((s) => s.id === id)?.label ?? id;

export const SERVICES = ["Cerca elétrica", "Concertina", "Alambrado", "Gradil", "Portão automático", "Manutenção"];

export const APPOINTMENT_STATUS: Record<string, string> = {
  agendada: "Agendada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
