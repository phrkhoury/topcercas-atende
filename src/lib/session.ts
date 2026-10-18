import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./auth";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function checkPassword(password: string, stored: string) {
  const [, saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export type CurrentUser = { id: string; name: string; email: string; role: "admin" | "colaborador" };

/** Usuário logado e ativo, ou null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role === "admin" ? "admin" : "colaborador" };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/painel");
  return user;
}

/** Cria o primeiro administrador a partir do .env, se ainda não houver usuários. */
export async function ensureFirstAdmin() {
  if ((await db.user.count()) > 0) return;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  await db.user.create({ data: { name: "Administrador", email, passwordHash: await hashPassword(password), role: "admin" } });
}

/**
 * Regra de acesso: o colaborador vê só as conversas atribuídas a ele;
 * o administrador vê todas (as dele, as dos colaboradores e as sem responsável).
 */
export function conversationScope(user: CurrentUser) {
  return user.role === "admin" ? {} : { assignedToId: user.id };
}

/** Mesma regra aplicada aos contatos (CRM, agenda, painel). */
export function contactScope(user: CurrentUser) {
  return user.role === "admin" ? {} : { conversation: { is: { assignedToId: user.id } } };
}

export async function canAccessConversation(user: CurrentUser, conversationId: string) {
  const conv = await db.conversation.findFirst({ where: { id: conversationId, ...conversationScope(user) }, select: { id: true } });
  return Boolean(conv);
}

export async function canAccessContact(user: CurrentUser, contactId: string) {
  const contact = await db.contact.findFirst({ where: { id: contactId, ...contactScope(user) }, select: { id: true } });
  return Boolean(contact);
}
