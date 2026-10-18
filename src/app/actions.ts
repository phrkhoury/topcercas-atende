"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { checkPassword, ensureFirstAdmin, hashPassword, requireAdmin, requireUser } from "@/lib/session";
import { SERVICE_SEPARATOR } from "@/lib/constants";
import { STAGE_COLORS, stageExists, visitStageId } from "@/lib/stages";
import { fromLocal } from "@/lib/time";

// ---------- Login ----------
export async function login(_prev: string | null, form: FormData) {
  await ensureFirstAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await checkPassword(password, user.passwordHash))) return "E-mail ou senha incorretos.";
  if (!user.active) return "Seu acesso foi desativado. Fale com o administrador.";
  (await cookies()).set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  // Vai direto ao destino final: redirecionar para "/" (que redireciona de novo) quebra o login em produção.
  const next = String(form.get("next") ?? "");
  const safe = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") && next !== "/";
  redirect(safe ? next : "/painel");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- CRM ----------
export async function moveStage(contactId: string, stage: string) {
  await requireUser();
  if (!(await stageExists(stage))) throw new Error("Etapa não encontrada");
  await db.contact.update({ where: { id: contactId }, data: { stage } });
  revalidatePath("/crm");
}

const contactInput = z.object({
  id: z.string(),
  name: z.string().trim().max(120).optional(),
  service: z.string().trim().max(500).optional(),
  address: z.string().trim().max(240).optional(),
  meters: z.coerce.number().int().min(0).optional(),
  value: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(4000).optional(),
  stage: z.string().min(1),
});

export async function updateContact(form: FormData) {
  await requireUser();
  const raw = Object.fromEntries([...form.entries()].filter(([, v]) => v !== ""));
  // Vários serviços podem ser marcados: grava todos juntos, separados por vírgula.
  const services = form.getAll("service").map(String).filter(Boolean);
  const { id, ...rest } = contactInput.parse({ ...raw, service: services.length ? services.join(SERVICE_SEPARATOR) : undefined });
  if (!(await stageExists(rest.stage))) throw new Error("Etapa não encontrada");
  await db.contact.update({
    where: { id },
    data: {
      stage: rest.stage,
      name: rest.name ?? null,
      service: rest.service ?? null,
      address: rest.address ?? null,
      meters: rest.meters ?? null,
      value: rest.value ?? null,
      notes: rest.notes ?? null,
    },
  });
  revalidatePath("/crm");
}

// ---------- Agenda ----------
const appointmentInput = z.object({
  contactId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.coerce.number().int().min(15).max(480),
  address: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function createAppointment(form: FormData) {
  await requireUser();
  const data = appointmentInput.parse(Object.fromEntries([...form.entries()].filter(([, v]) => v !== "")));
  await db.appointment.create({
    data: { contactId: data.contactId, start: fromLocal(`${data.date}T${data.time}`), durationMin: data.durationMin, address: data.address, notes: data.notes },
  });
  const visitStage = await visitStageId();
  if (visitStage) await db.contact.update({ where: { id: data.contactId }, data: { stage: visitStage } });
  revalidatePath("/agenda");
}

export async function setAppointmentStatus(id: string, status: string) {
  await requireUser();
  const parsed = z.enum(["agendada", "concluida", "cancelada"]).parse(status);
  await db.appointment.update({ where: { id }, data: { status: parsed } });
  revalidatePath("/agenda");
}

// ---------- Configurações ----------
const settingsInput = z.object({
  companyName: z.string().trim().min(1).max(80),
  assistantName: z.string().trim().min(1).max(40),
  knowledge: z.string().trim().min(1).max(20000),
  instructions: z.string().trim().max(10000),
  workDays: z.array(z.string().regex(/^[0-6]$/)).min(1),
  workStart: z.string().regex(/^\d{2}:\d{2}$/),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/),
  visitMinutes: z.coerce.number().int().min(15).max(480),
  aiEnabled: z.boolean(),
  services: z.string().max(5000),
});

export async function saveSettings(_prev: string | null, form: FormData) {
  await requireAdmin();
  const parsed = settingsInput.safeParse({
    ...Object.fromEntries(form.entries()),
    workDays: form.getAll("workDays"),
    aiEnabled: form.get("aiEnabled") === "on",
  });
  if (!parsed.success) return "Confira os campos: " + parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  if (parsed.data.workStart >= parsed.data.workEnd) return "O fim do expediente deve ser depois do início.";
  // Serviços: um por linha, sem vírgulas (a vírgula separa vários serviços na ficha do lead), sem repetidos.
  const services = [...new Set(parsed.data.services.split(/\r?\n/).map((s) => s.replace(/,/g, " ").trim()).filter(Boolean))].join("\n");
  const data = { ...parsed.data, services, workDays: parsed.data.workDays.sort().join(",") };
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  revalidatePath("/configuracoes");
  return "Configurações salvas.";
}

// ---------- Equipe (só administrador) ----------
const userInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres"),
  role: z.enum(["admin", "colaborador"]),
});

export async function createUser(_prev: string | null, form: FormData) {
  await requireAdmin();
  const parsed = userInput.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Dados inválidos.";
  const { password, ...data } = parsed.data;
  if (await db.user.findUnique({ where: { email: data.email } })) return "Já existe um usuário com esse e-mail.";
  await db.user.create({ data: { ...data, passwordHash: await hashPassword(password) } });
  revalidatePath("/equipe");
  return `Usuário ${data.name} criado.`;
}

export async function setUserActive(userId: string, active: boolean) {
  const admin = await requireAdmin();
  if (userId === admin.id) return; // não deixa o admin se trancar para fora
  await db.user.update({ where: { id: userId }, data: { active } });
  if (!active) {
    // Conversas do colaborador desativado voltam para a fila
    await db.conversation.updateMany({ where: { assignedToId: userId }, data: { assignedToId: null } });
  }
  revalidatePath("/equipe");
}

export async function resetPassword(_prev: string | null, form: FormData) {
  await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return "A senha precisa de pelo menos 8 caracteres.";
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  return "Senha redefinida.";
}

// ---------- Etapas do funil (só administrador) ----------
const stageInput = z.object({
  name: z.string().trim().min(1, "Dê um nome à etapa").max(40),
  color: z.string().refine((c) => STAGE_COLORS.includes(c), "Cor inválida"),
});

function revalidateStages() {
  revalidatePath("/crm");
  revalidatePath("/crm/etapas");
  revalidatePath("/painel");
}

export async function createStage(_prev: string | null, form: FormData) {
  await requireAdmin();
  const parsed = stageInput.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Dados inválidos.";
  const last = await db.stage.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
  await db.stage.create({ data: { ...parsed.data, position: (last?.position ?? 0) + 1 } });
  revalidateStages();
  return `Etapa "${parsed.data.name}" criada.`;
}

export async function updateStage(_prev: string | null, form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const parsed = stageInput.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Dados inválidos.";
  const isVisit = form.get("isVisit") === "on";
  // Só uma etapa pode ser a de "visita agendada".
  if (isVisit) await db.stage.updateMany({ where: { id: { not: id } }, data: { isVisit: false } });
  await db.stage.update({ where: { id }, data: { ...parsed.data, isVisit } });
  revalidateStages();
  return "Salvo.";
}

export async function moveStageOrder(id: string, direction: "up" | "down") {
  await requireAdmin();
  const stages = await db.stage.findMany({ orderBy: { position: "asc" } });
  const i = stages.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= stages.length) return;
  [stages[i], stages[j]] = [stages[j], stages[i]];
  await db.$transaction(stages.map((s, pos) => db.stage.update({ where: { id: s.id }, data: { position: pos + 1 } })));
  revalidateStages();
}

export async function deleteStage(_prev: string | null, form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const moveTo = String(form.get("moveTo") ?? "");
  if ((await db.stage.count()) <= 1) return "O funil precisa ter pelo menos uma etapa.";
  if (!moveTo || moveTo === id || !(await stageExists(moveTo))) return "Escolha para qual etapa mover os leads.";
  await db.$transaction([
    db.contact.updateMany({ where: { stage: id }, data: { stage: moveTo } }),
    db.stage.delete({ where: { id } }),
  ]);
  revalidateStages();
  return null;
}
