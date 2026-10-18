"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { checkPassword, ensureFirstAdmin, hashPassword, requireAdmin, requireUser } from "@/lib/session";
import { STAGE_IDS } from "@/lib/constants";
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
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- CRM ----------
export async function moveStage(contactId: string, stage: string) {
  await requireUser();
  const parsed = z.enum(STAGE_IDS).parse(stage);
  await db.contact.update({ where: { id: contactId }, data: { stage: parsed } });
  revalidatePath("/crm");
}

const contactInput = z.object({
  id: z.string(),
  name: z.string().trim().max(120).optional(),
  service: z.string().trim().max(120).optional(),
  address: z.string().trim().max(240).optional(),
  meters: z.coerce.number().int().min(0).optional(),
  value: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(4000).optional(),
  stage: z.enum(STAGE_IDS),
});

export async function updateContact(form: FormData) {
  await requireUser();
  const raw = Object.fromEntries([...form.entries()].filter(([, v]) => v !== ""));
  const { id, ...rest } = contactInput.parse(raw);
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
  await db.contact.update({ where: { id: data.contactId }, data: { stage: "visita_agendada" } });
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
  const data = { ...parsed.data, workDays: parsed.data.workDays.sort().join(",") };
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
