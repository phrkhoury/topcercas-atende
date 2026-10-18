import { redirect } from "next/navigation";

// Dinâmica para não virar um redirecionamento estático no build de produção.
export const dynamic = "force-dynamic";

export default function Home() {
  redirect("/painel");
}
