import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-full items-center justify-center bg-[radial-gradient(60%_50%_at_50%_0%,rgba(63,191,74,0.18),transparent_70%)] p-4">
      <div className="card w-full max-w-sm p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="TOPCERCAS" className="mx-auto mb-2 h-7 w-auto" />
        <p className="mb-8 text-center text-sm text-muted">Atendimento com IA</p>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
