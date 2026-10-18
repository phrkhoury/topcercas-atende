// Catálogo das páginas da sidebar. Sem acesso ao banco: pode ser usado no navegador e no servidor.

export type PageDef = {
  key: string;
  href: string;
  label: string;
  description: string;
  /** Fica sempre no bloco principal da sidebar (as demais vão para atalhos ou "Mais"). */
  main?: boolean;
  adminOnly?: boolean;
  /** O administrador pode esconder esta página da sidebar de todos. */
  hideable?: boolean;
};

export const PAGES: PageDef[] = [
  { key: "painel", href: "/painel", label: "Início", description: "Resumo do atendimento", main: true },
  { key: "conversas", href: "/conversas", label: "Chats", description: "Conversas do WhatsApp", main: true },
  { key: "crm", href: "/crm", label: "Contatos", description: "Leads e funil de vendas", main: true },
  { key: "agenda", href: "/agenda", label: "Agendamentos", description: "Visitas técnicas e lembretes", main: true, hideable: true },
  { key: "ia", href: "/configuracoes", label: "Assistente IA", description: "Conhecimento, regras e horários da IA", main: true, adminOnly: true },
  { key: "whatsapp", href: "/whatsapp", label: "Conexões", description: "Conectar o WhatsApp por QR Code", adminOnly: true, hideable: true },
  { key: "simulador", href: "/simulador", label: "Simulador", description: "Testar a IA como se fosse um cliente", adminOnly: true, hideable: true },
  { key: "etapas", href: "/crm/etapas", label: "Etapas do funil", description: "Criar e organizar as etapas do CRM", adminOnly: true, hideable: true },
  { key: "workspace", href: "/equipe", label: "Workspace", description: "Equipe e páginas da sidebar", adminOnly: true },
];

export const PAGE_KEYS = PAGES.map((p) => p.key);

export const splitKeys = (value: string | null | undefined) => (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
