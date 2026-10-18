// Cria as configurações iniciais e alguns leads de exemplo (todos fictícios, pelo canal "sim").
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SETTINGS } from "../src/lib/settings-defaults";

const db = new PrismaClient();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

async function main() {
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, ...DEFAULT_SETTINGS }, update: {} });

  const examples = [
    {
      phone: "5531900000001", name: "Carla Mendes", stage: "qualificado", service: "Cerca elétrica", address: "Castelo, BH", meters: 42,
      messages: [
        ["customer", "Oi! Quero colocar cerca elétrica na minha casa", 30],
        ["ai", "Oi, Carla! Que bom falar com você 😊 Para eu entender melhor: é casa ou sobrado, e em qual bairro?", 29],
        ["customer", "Casa no Castelo, o muro tem uns 42 metros", 25],
        ["ai", "Perfeito! A visita técnica é gratuita e lá medimos tudo certinho. Quer que eu veja os horários disponíveis?", 24],
      ],
    },
    {
      phone: "5531900000002", name: "Roberto Lima", stage: "novo", service: null, address: null, meters: null,
      messages: [["customer", "Boa tarde, vocês fazem alambrado?", 8]],
    },
    {
      phone: "5531900000003", name: "Condomínio Jardins", stage: "orcamento", service: "Gradil", address: "Buritis, BH", meters: 120, value: 18500,
      messages: [
        ["customer", "Recebemos o orçamento do gradil, vamos levar para a assembleia", 300],
        ["ai", "Ótimo! Se precisarem de memorial descritivo ou imagens de referência para a assembleia, é só pedir.", 299],
      ],
    },
  ] as const;

  for (const ex of examples) {
    if (await db.contact.findUnique({ where: { phone: ex.phone } })) continue;
    const contact = await db.contact.create({
      data: { phone: ex.phone, name: ex.name, stage: ex.stage, service: ex.service, address: ex.address, meters: ex.meters, value: "value" in ex ? ex.value : null },
    });
    const conversation = await db.conversation.create({ data: { contactId: contact.id, lastMessageAt: minutesAgo(ex.messages.at(-1)![2]) } });
    for (const [role, text, ago] of ex.messages) {
      await db.message.create({ data: { conversationId: conversation.id, role, text, createdAt: minutesAgo(ago) } });
    }
  }
}

main().finally(() => db.$disconnect());
