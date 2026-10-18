// Horário de Brasília (UTC-3, sem horário de verão desde 2019).
export const TZ = "America/Sao_Paulo";
const OFFSET = "-03:00";

/** "2026-10-20T14:30" (horário local) -> Date */
export function fromLocal(dateTime: string) {
  return new Date(`${dateTime.length === 16 ? dateTime + ":00" : dateTime}${OFFSET}`);
}

/** Date -> { date: "2026-10-20", time: "14:30", weekday: 0..6 } no horário local */
export function toLocalParts(d: Date) {
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), weekday: local.getUTCDay() };
}

export function formatDateTime(d: Date) {
  return d.toLocaleString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatTime(d: Date) {
  return d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function formatDayLong(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" });
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Horários de início livres em um dia, dados o expediente e as visitas já marcadas. */
export function freeSlots(opts: {
  date: string;
  workDays: string;
  workStart: string;
  workEnd: string;
  visitMinutes: number;
  busy: { start: Date; durationMin: number }[];
  now?: Date;
}) {
  const weekday = new Date(`${opts.date}T12:00:00Z`).getUTCDay();
  if (!opts.workDays.split(",").map(Number).includes(weekday)) return [];
  const now = opts.now ?? new Date();
  const slots: string[] = [];
  for (let m = toMin(opts.workStart); m + opts.visitMinutes <= toMin(opts.workEnd); m += opts.visitMinutes) {
    const start = fromLocal(`${opts.date}T${toHHMM(m)}`);
    const end = new Date(start.getTime() + opts.visitMinutes * 60_000);
    if (start.getTime() < now.getTime() + 60 * 60_000) continue; // pelo menos 1h de antecedência
    const clash = opts.busy.some((b) => start < new Date(b.start.getTime() + b.durationMin * 60_000) && b.start < end);
    if (!clash) slots.push(toHHMM(m));
  }
  return slots;
}
