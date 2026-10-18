// Conexão com o WhatsApp por QR Code (WhatsApp Web, não oficial).
// A sessão fica salva em disco; no Railway, dentro do volume /data.
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  isJidBroadcast,
  isJidGroup,
  isPnUser,
  jidDecode,
  useMultiFileAuthState as loadAuthState,
  type Contact,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import { handleIncoming, importHistory, recordReplyFromPhone, type HistoryItem } from "./inbox";

/** Quantos dias de conversas antigas importar ao conectar. */
const HISTORY_DAYS = 10;

export type WaStatus = "disconnected" | "connecting" | "qr" | "connected";
export type WaState = { status: WaStatus; qr?: string; me?: string; message?: string; updatedAt: string };

const AUTH_DIR = process.env.WA_AUTH_DIR || (existsSync("/data") ? "/data/wa-auth" : path.join(process.cwd(), ".wa-auth"));

type Holder = { sock?: WASocket; state: WaState; sentIds: Set<string>; starting?: boolean; importedCount?: number };
const g = globalThis as unknown as { __waQr?: Holder };
const holder: Holder = (g.__waQr ??= { state: { status: "disconnected", updatedAt: new Date().toISOString() }, sentIds: new Set() });

function setState(patch: Omit<WaState, "updatedAt">) {
  holder.state = { ...patch, updatedAt: new Date().toISOString() };
}

// Logger silencioso no formato que a biblioteca espera (só avisos e erros no console).
const logger = {
  level: "warn",
  child() {
    return logger;
  },
  trace() {},
  debug() {},
  info() {},
  warn(obj: unknown, msg?: string) {
    console.warn("[whatsapp]", msg ?? "", typeof obj === "string" ? obj : "");
  },
  error(obj: unknown, msg?: string) {
    console.error("[whatsapp]", msg ?? "", obj);
  },
};

export const getWaState = () => ({ ...holder.state, imported: holder.importedCount ?? 0 });
export const hasSavedSession = () => existsSync(path.join(AUTH_DIR, "creds.json"));

/** Conecta (ou reconecta). Sem sessão salva, gera um QR Code para ler no celular. */
export async function startWhatsApp() {
  if (holder.starting || holder.state.status === "connected") return;
  holder.starting = true;
  try {
    mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await loadAuthState(AUTH_DIR);
    setState({ status: "connecting", message: "Conectando ao WhatsApp…" });

    const sock = makeWASocket({
      auth: state,
      logger,
      // Conectar como "computador" faz o WhatsApp enviar mais histórico na primeira leitura do QR.
      browser: Browsers.macOS("TOPCERCAS Atende"),
      markOnlineOnConnect: false, // mantém as notificações no celular
      syncFullHistory: true,
    });
    holder.sock = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      if (update.qr) {
        setState({ status: "qr", qr: await QRCode.toDataURL(update.qr, { margin: 1, width: 320 }), message: "Leia o QR Code com o celular" });
      }
      if (update.connection === "open") {
        const me = jidDecode(sock.user?.id)?.user;
        setState({ status: "connected", me, message: "Conectado" });
      }
      if (update.connection === "close") {
        holder.sock = undefined;
        const code = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          rmSync(AUTH_DIR, { recursive: true, force: true });
          setState({ status: "disconnected", message: "Sessão encerrada pelo celular. Gere um novo QR Code para conectar." });
        } else {
          // Queda de rede ou reinício pedido pelo WhatsApp (comum logo após ler o QR): reconecta.
          setState({ status: "connecting", message: "Reconectando…" });
          setTimeout(() => startWhatsApp().catch((err) => console.error("[whatsapp] reconexão", err)), 3000);
        }
      }
    });

    sock.ev.on("messages.upsert", ({ messages, type }) => {
      for (const m of messages) {
        handleMessage(m, type).catch((err) => console.error("[whatsapp] mensagem", err));
      }
    });

    // Histórico enviado pelo celular logo após conectar (chega em vários lotes).
    sock.ev.on("messaging-history.set", ({ messages, contacts, lidPnMappings }) => {
      importHistoryBatch(messages, contacts, lidPnMappings ?? [])
        .then((n) => {
          if (n > 0) {
            holder.importedCount = (holder.importedCount ?? 0) + n;
            console.log(`[whatsapp] histórico: ${n} mensagens importadas`);
          }
        })
        .catch((err) => console.error("[whatsapp] histórico", err));
    });
  } finally {
    holder.starting = false;
  }
}

/** Desconecta e apaga a sessão salva (será preciso ler o QR de novo). */
export async function logoutWhatsApp() {
  try {
    await holder.sock?.logout();
  } catch {
    // já estava desconectado
  }
  holder.sock = undefined;
  rmSync(AUTH_DIR, { recursive: true, force: true });
  setState({ status: "disconnected", message: "Desconectado." });
}

/** Envia texto pela conexão QR. Retorna false se não estiver conectado. */
export async function sendViaQr(jid: string, text: string) {
  const sock = holder.sock;
  if (!sock || holder.state.status !== "connected") return false;
  const sent = await sock.sendMessage(jid, { text });
  if (sent?.key.id) holder.sentIds.add(sent.key.id);
  if (holder.sentIds.size > 2000) holder.sentIds.clear();
  return true;
}

function messageText(m: WAMessage): string | null {
  const msg = m.message;
  if (!msg) return null;
  if (msg.protocolMessage || msg.reactionMessage || msg.senderKeyDistributionMessage) return null;
  const text = msg.conversation ?? msg.extendedTextMessage?.text ?? msg.imageMessage?.caption ?? msg.videoMessage?.caption ?? msg.documentMessage?.caption;
  if (text) return text;
  if (msg.audioMessage) return "[áudio recebido — ouça no celular]";
  if (msg.imageMessage) return "[foto recebida — veja no celular]";
  if (msg.videoMessage) return "[vídeo recebido — veja no celular]";
  if (msg.documentMessage) return "[documento recebido — veja no celular]";
  if (msg.stickerMessage) return "[figurinha]";
  if (msg.locationMessage) return "[localização recebida — veja no celular]";
  if (msg.contactMessage) return "[contato recebido — veja no celular]";
  return null;
}

const isPrivateChat = (jid: string | null | undefined): jid is string =>
  Boolean(jid && !isJidGroup(jid) && !isJidBroadcast(jid) && !jid.endsWith("@newsletter"));

/** Número de telefone real. O WhatsApp às vezes identifica o contato por um "LID" em vez do número. */
function phoneOf(m: WAMessage, lidToPn?: Map<string, string>) {
  const jid = m.key.remoteJid!;
  const alt = m.key.remoteJidAlt;
  const pnJid = isPnUser(jid) ? jid : alt && isPnUser(alt) ? alt : (lidToPn?.get(jid) ?? null);
  return jidDecode(pnJid ?? jid)?.user ?? null;
}

async function handleMessage(m: WAMessage, type: string) {
  const jid = m.key.remoteJid;
  if (!isPrivateChat(jid)) return;

  // "append" traz mensagens antigas/sincronizadas: só aceitamos as recentes enviadas pelo próprio celular.
  const ts = Number(m.messageTimestamp ?? 0) * 1000;
  if (type !== "notify" && !(m.key.fromMe && Date.now() - ts < 2 * 60_000)) return;

  const text = messageText(m);
  const phone = phoneOf(m);
  if (!text || !phone) return;
  const waId = m.key.id ?? undefined;

  if (m.key.fromMe) {
    if (waId && holder.sentIds.has(waId)) return; // enviada pelo próprio app
    await recordReplyFromPhone({ phone, waJid: jid, text, waId });
    return;
  }
  await handleIncoming({ phone, name: m.pushName ?? undefined, text, channel: "whatsapp", waJid: jid, waId });
}

/** Converte um lote do histórico do celular e grava só conversas individuais dos últimos HISTORY_DAYS dias. */
async function importHistoryBatch(messages: WAMessage[], contacts: Contact[], lidPnMappings: { lid: string; pn: string }[]) {
  const since = Date.now() - HISTORY_DAYS * 86_400_000;
  const lidToPn = new Map<string, string>(lidPnMappings.map((x) => [x.lid, x.pn]));
  const names = new Map<string, string>();
  for (const c of contacts) {
    if (c.lid && c.phoneNumber) lidToPn.set(c.lid, c.phoneNumber);
    const name = c.name ?? c.notify ?? c.verifiedName;
    if (name) for (const id of [c.id, c.lid, c.phoneNumber]) if (id) names.set(id, name);
  }

  const items: HistoryItem[] = [];
  for (const m of messages) {
    const jid = m.key.remoteJid;
    const at = Number(m.messageTimestamp ?? 0) * 1000;
    if (!isPrivateChat(jid) || !m.key.id || at < since) continue;
    const text = messageText(m);
    const phone = phoneOf(m, lidToPn);
    if (!text || !phone) continue;
    items.push({
      phone,
      waJid: jid,
      name: (!m.key.fromMe ? m.pushName : null) ?? names.get(jid) ?? undefined,
      fromMe: Boolean(m.key.fromMe),
      text,
      at: new Date(at),
      waId: m.key.id,
    });
  }
  return items.length ? importHistory(items) : 0;
}
