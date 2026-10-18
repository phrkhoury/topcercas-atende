import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOPCERCAS Atende",
  description: "Atendimento com IA no WhatsApp da TOPCERCAS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
