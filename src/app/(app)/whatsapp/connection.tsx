"use client";

import { useCallback, useEffect, useState } from "react";

type State = { status: "disconnected" | "connecting" | "qr" | "connected"; qr?: string; me?: string; message?: string; cloudApi?: boolean };

const LABEL: Record<State["status"], { text: string; style: string }> = {
  disconnected: { text: "Desconectado", style: "bg-rose-500/15 text-rose-300" },
  connecting: { text: "Conectando…", style: "bg-amber-500/15 text-amber-300" },
  qr: { text: "Aguardando leitura do QR", style: "bg-sky-500/15 text-sky-300" },
  connected: { text: "Conectado", style: "bg-brand/15 text-brand" },
};

export function WhatsAppConnection() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/wa-session", { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: "connect" | "logout") {
    if (action === "logout" && !confirm("Desconectar o WhatsApp? A IA para de receber mensagens até você ler o QR de novo.")) return;
    setBusy(true);
    await fetch("/api/wa-session", { method: "POST", body: JSON.stringify({ action }) });
    await load();
    setBusy(false);
  }

  if (!state) return <div className="p-8 text-sm text-dim">Carregando…</div>;
  const label = LABEL[state.status];

  return (
    <div className="grid max-w-5xl gap-6 p-4 md:p-8 lg:grid-cols-[1fr_360px]">
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Conexão por QR Code</h2>
          <span className={`chip px-3 py-1 text-xs ${label.style}`}>● {label.text}</span>
        </div>

        {state.cloudApi && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            A API oficial da Meta está configurada e tem prioridade no envio. Para usar o QR Code, remova as variáveis WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.
          </p>
        )}

        {state.status === "connected" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm">
              Conectado ao número <strong>+{state.me}</strong>. As mensagens que chegarem aparecem em <strong>Conversas</strong> e a IA responde automaticamente.
            </p>
            <button className="btn-ghost hover:border-rose-400" disabled={busy} onClick={() => act("logout")}>Desconectar</button>
          </div>
        )}

        {state.status === "qr" && state.qr && (
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.qr} alt="QR Code do WhatsApp" className="size-64 rounded-xl bg-white p-2" />
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
              <li>Abra o WhatsApp no celular da empresa.</li>
              <li>Toque em <strong className="text-ink">⋮ / Configurações → Aparelhos conectados</strong>.</li>
              <li>Toque em <strong className="text-ink">Conectar um aparelho</strong> e aponte a câmera para o QR Code.</li>
              <li>O QR muda a cada poucos segundos; esta tela atualiza sozinha.</li>
            </ol>
          </div>
        )}

        {state.status === "connecting" && <p className="mt-6 text-sm text-muted">{state.message ?? "Conectando…"}</p>}

        {state.status === "disconnected" && (
          <div className="mt-6 space-y-4">
            {state.message && <p className="text-sm text-muted">{state.message}</p>}
            <button className="btn-primary" disabled={busy} onClick={() => act("connect")}>{busy ? "Gerando…" : "Gerar QR Code"}</button>
          </div>
        )}
      </section>

      <aside className="card h-fit space-y-3 p-5 text-sm text-muted">
        <h3 className="font-semibold text-ink">Antes de conectar</h3>
        <p>
          Esta conexão funciona como o <strong className="text-ink">WhatsApp Web</strong> e <strong className="text-ink">não é oficial</strong>. O WhatsApp pode bloquear números que
          enviam mensagens automáticas em excesso ou para quem não iniciou a conversa.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Use preferencialmente um número dedicado ao atendimento.</li>
          <li>Deixe a IA apenas responder quem mandou mensagem.</li>
          <li>O celular precisa ficar com internet de vez em quando para manter a sessão.</li>
          <li>Respostas enviadas pelo próprio celular aparecem no painel e pausam a IA na conversa.</li>
        </ul>
      </aside>
    </div>
  );
}
