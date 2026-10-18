import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/auth";

export async function middleware(req: NextRequest) {
  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // O webhook do WhatsApp é chamado pela Meta e se valida pelo token próprio.
  matcher: ["/((?!login|api/whatsapp|_next|icon.png|logo.png|favicon.ico).*)"],
};
