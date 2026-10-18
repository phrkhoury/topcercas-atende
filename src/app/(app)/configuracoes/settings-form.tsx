"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/actions";

type Settings = {
  companyName: string;
  assistantName: string;
  knowledge: string;
  instructions: string;
  workDays: string;
  workStart: string;
  workEnd: string;
  visitMinutes: number;
  aiEnabled: boolean;
  services: string; // um por linha
};

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function SettingsForm({ settings }: { settings: Settings }) {
  const [message, action, pending] = useActionState(saveSettings, null);
  const days = settings.workDays.split(",");

  return (
    <form action={action} className="max-w-3xl space-y-6 p-4 md:p-8">
      <section className="card space-y-4 p-5">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-semibold">IA ligada</span>
            <span className="text-sm text-muted">Desligada, as mensagens chegam na caixa de conversas e só a equipe responde.</span>
          </span>
          <input type="checkbox" name="aiEnabled" defaultChecked={settings.aiEnabled} className="size-5 accent-[#3fbf4a]" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="companyName">Nome da empresa</label>
            <input id="companyName" name="companyName" defaultValue={settings.companyName} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="assistantName">Nome da atendente virtual</label>
            <input id="assistantName" name="assistantName" defaultValue={settings.assistantName} required className="input" />
          </div>
        </div>
      </section>

      <section className="card space-y-2 p-5">
        <label className="font-semibold" htmlFor="services">Produtos e serviços</label>
        <p className="text-sm text-muted">Um por linha. Aparecem como opções na ficha do lead (CRM) e a IA usa esses nomes ao registrar o interesse do cliente.</p>
        <textarea id="services" name="services" rows={7} defaultValue={settings.services} className="input text-sm leading-relaxed" />
      </section>

      <section className="card space-y-2 p-5">
        <label className="font-semibold" htmlFor="knowledge">O que a IA sabe sobre a empresa</label>
        <p className="text-sm text-muted">Serviços, região de atendimento, formas de pagamento, garantia, diferenciais. A IA responde só com base neste texto.</p>
        <textarea id="knowledge" name="knowledge" rows={16} defaultValue={settings.knowledge} required className="input font-mono text-[13px] leading-relaxed" />
      </section>

      <section className="card space-y-2 p-5">
        <label className="font-semibold" htmlFor="instructions">Regras de atendimento</label>
        <p className="text-sm text-muted">Como a IA deve se comportar: o que pode ou não dizer, quando passar para a equipe.</p>
        <textarea id="instructions" name="instructions" rows={8} defaultValue={settings.instructions} className="input font-mono text-[13px] leading-relaxed" />
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Horários de visita técnica</h2>
          <p className="text-sm text-muted">A IA só oferece horários dentro deste expediente e sem conflito com a agenda.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d} className="cursor-pointer">
              <input type="checkbox" name="workDays" value={i} defaultChecked={days.includes(String(i))} className="peer sr-only" />
              <span className="block rounded-xl border border-line-2 px-3 py-1.5 text-sm text-muted peer-checked:border-brand peer-checked:bg-brand/15 peer-checked:text-ink">{d}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="workStart">Início</label>
            <input id="workStart" name="workStart" type="time" defaultValue={settings.workStart} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="workEnd">Fim</label>
            <input id="workEnd" name="workEnd" type="time" defaultValue={settings.workEnd} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="visitMinutes">Duração (min)</label>
            <input id="visitMinutes" name="visitMinutes" type="number" min={15} step={15} defaultValue={settings.visitMinutes} className="input" />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button className="btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar configurações"}</button>
        {message && <span className={`text-sm ${message.startsWith("Configurações") ? "text-brand" : "text-rose-400"}`}>{message}</span>}
      </div>
    </form>
  );
}
