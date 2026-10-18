// As etapas do funil ficam no banco (tabela Stage) e são editadas em CRM → Editar etapas. Veja src/lib/stages.ts.

export const SERVICES = ["Tela Soldada", "Tela Soldada Revestida", "Gradil", "Poste para Tela", "Poste para Gradil", "Portão"];

/** Serviços são gravados juntos num texto, separados por vírgula. */
export const SERVICE_SEPARATOR = ", ";
export const parseServices = (value: string | null | undefined) =>
  (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const APPOINTMENT_STATUS: Record<string, string> = {
  agendada: "Agendada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
