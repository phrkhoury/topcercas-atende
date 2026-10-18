"use client";

import { useActionState, useState } from "react";
import { createStage, deleteStage, moveStageOrder, updateStage } from "@/app/actions";
import type { StageInfo } from "@/lib/stages";

function ColorPicker({ colors, value, idPrefix }: { colors: string[]; value: string; idPrefix: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor">
      {colors.map((c) => (
        <label key={c} className="cursor-pointer">
          <input type="radio" name="color" value={c} defaultChecked={c === value} className="peer sr-only" id={`${idPrefix}-${c}`} />
          <span
            className="block size-6 rounded-full ring-offset-2 ring-offset-card peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand"
            style={{ backgroundColor: c }}
            title={c}
          />
        </label>
      ))}
    </div>
  );
}

export function StageRow({ stage, others, colors, index, total, leadCount }: { stage: StageInfo; others: StageInfo[]; colors: string[]; index: number; total: number; leadCount: number }) {
  const [saveMsg, save, saving] = useActionState(updateStage, null);
  const [deleteMsg, remove, deleting] = useActionState(deleteStage, null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-3 p-4">
      <form action={save} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={stage.id} />
        <div className="flex flex-col">
          <button type="button" className="text-dim hover:text-ink disabled:opacity-30" disabled={index === 0} onClick={() => moveStageOrder(stage.id, "up")} aria-label="Mover para cima">▲</button>
          <button type="button" className="text-dim hover:text-ink disabled:opacity-30" disabled={index === total - 1} onClick={() => moveStageOrder(stage.id, "down")} aria-label="Mover para baixo">▼</button>
        </div>
        <input name="name" defaultValue={stage.name} required maxLength={40} className="input w-56" aria-label="Nome da etapa" />
        <ColorPicker colors={colors} value={stage.color} idPrefix={stage.id} />
        <label className="flex items-center gap-2 text-xs text-muted" title="Quando uma visita é agendada (pela IA ou pela agenda), o lead vai para esta etapa">
          <input type="checkbox" name="isVisit" defaultChecked={stage.isVisit} className="accent-[#3fbf4a]" />
          Etapa de visita agendada
        </label>
        <span className="text-xs text-dim">{leadCount} lead{leadCount === 1 ? "" : "s"}</span>
        <div className="ml-auto flex items-center gap-2">
          {saveMsg && <span className={`text-xs ${saveMsg === "Salvo." ? "text-brand" : "text-rose-400"}`}>{saveMsg}</span>}
          <button className="btn-primary px-3 py-1.5" disabled={saving}>Salvar</button>
          {total > 1 && (
            <button type="button" className="btn-ghost px-3 py-1.5 hover:border-rose-400" onClick={() => setConfirmDelete(!confirmDelete)}>
              Excluir
            </button>
          )}
        </div>
      </form>

      {confirmDelete && (
        <form action={remove} className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm">
          <input type="hidden" name="id" value={stage.id} />
          <span>Excluir &quot;{stage.name}&quot; e mover {leadCount ? `os ${leadCount} leads` : "os leads"} para</span>
          <select name="moveTo" required defaultValue={others[0]?.id} className="input w-auto py-1">
            {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button className="btn-primary bg-rose-500 px-3 py-1 text-white hover:bg-rose-400" disabled={deleting}>Confirmar exclusão</button>
          <button type="button" className="btn-ghost px-3 py-1" onClick={() => setConfirmDelete(false)}>Cancelar</button>
          {deleteMsg && <span className="text-rose-300">{deleteMsg}</span>}
        </form>
      )}
    </div>
  );
}

export function NewStageForm({ colors }: { colors: string[] }) {
  const [message, action, pending] = useActionState(createStage, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="new-stage-name">Nome</label>
        <input id="new-stage-name" name="name" required maxLength={40} placeholder="Ex.: Aguardando pagamento" className="input" />
      </div>
      <div>
        <span className="label">Cor</span>
        <ColorPicker colors={colors} value={colors[0]} idPrefix="new" />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Criando…" : "Criar etapa"}</button>
      {message && <p className={`text-sm ${message.endsWith("criada.") ? "text-brand" : "text-rose-400"}`}>{message}</p>}
      <p className="text-xs text-dim">A nova etapa entra no fim do funil. Use as setas para mudar a ordem.</p>
    </form>
  );
}
