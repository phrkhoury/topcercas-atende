import { db } from "./db";
import { DEFAULT_SETTINGS } from "./settings-defaults";
import { SERVICES } from "./constants";

export async function getSettings() {
  return (await db.settings.findUnique({ where: { id: 1 } })) ?? db.settings.create({ data: { id: 1, ...DEFAULT_SETTINGS } });
}

/** Lista de produtos/serviços configurada em Configurar IA (um por linha). Vazia = lista padrão. */
export function servicesFrom(settings: { services: string }) {
  const list = settings.services
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? [...new Set(list)] : SERVICES;
}

export async function getServices() {
  return servicesFrom(await getSettings());
}
