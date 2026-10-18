// Roda uma vez ao iniciar o servidor. O import fica dentro do "if" para que o Next
// não empacote as bibliotecas do Node (WhatsApp, banco) na versão edge deste arquivo.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
