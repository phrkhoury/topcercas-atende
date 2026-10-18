-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#94a3b8',
    "position" INTEGER NOT NULL,
    "isVisit" BOOLEAN NOT NULL DEFAULT false
);


-- Etapas iniciais (mesmos ids usados antes, para os leads existentes continuarem na etapa certa)
INSERT INTO "Stage" ("id", "name", "color", "position", "isVisit") VALUES
  ('novo', 'Novo', '#94a3b8', 1, false),
  ('qualificado', 'Qualificado', '#0ea5e9', 2, false),
  ('visita_agendada', 'Visita agendada', '#f59e0b', 3, true),
  ('orcamento', 'Orçamento enviado', '#8b5cf6', 4, false),
  ('fechado', 'Fechado', '#10b981', 5, false),
  ('perdido', 'Perdido', '#f43f5e', 6, false);
