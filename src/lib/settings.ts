import { db } from "./db";
import { DEFAULT_SETTINGS } from "./settings-defaults";

export async function getSettings() {
  return (await db.settings.findUnique({ where: { id: 1 } })) ?? db.settings.create({ data: { id: 1, ...DEFAULT_SETTINGS } });
}
