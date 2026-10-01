import * as readline from "readline";
import { askWithRAG } from "./rag/rag-chain.js";

/**
 * Chat RAG directo (`npm run rag-chat`): cada pregunta se responde solo con la
 * documentación indexada, sin tools ni memoria entre preguntas. Para el agente
 * completo usa `npm run dev`.
 */
async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   DevAssistant — Documentación TaskFlow  ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log('\nEscribe tu pregunta o "salir" para terminar.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let closed = false;
  rl.on("close", () => {
    closed = true;
  });

  const ask = (): void => {
    if (closed) return;

    rl.question("Tú: ", async (input) => {
      const msg = input.trim();

      if (msg.toLowerCase() === "salir") {
        console.log("\n¡Hasta luego!");
        rl.close();
        return;
      }

      if (!msg) {
        ask();
        return;
      }

      try {
        process.stdout.write("Asistente: ");
        await askWithRAG(msg, (chunk) => process.stdout.write(chunk));
        process.stdout.write("\n\n");
      } catch (err) {
        console.error("Error:", err instanceof Error ? err.message : err);
      }

      ask();
    });
  };

  ask();
}

main().catch(console.error);
