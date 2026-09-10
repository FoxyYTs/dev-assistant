import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import * as readline from "readline";
import { config } from "./config.js";
import { queryDocuments } from "./rag/query.js";
import type { Message } from "./types.js";

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
const openai = new OpenAI({ apiKey: config.openaiApiKey });

const history: Message[] = [];

async function chat(userMessage: string): Promise<string> {
  const results = await queryDocuments(userMessage, openai);

  const context = results
    .map((r) => `[Fuente: ${r.chunk.metadata.source}]\n${r.chunk.content}`)
    .join("\n\n---\n\n");

  const system = `Eres un asistente técnico experto en la API TaskFlow.
Responde usando ÚNICAMENTE la información del contexto proporcionado.
Si la respuesta no está en el contexto, indícalo claramente.

CONTEXTO:
${context}`;

  history.push({ role: "user", content: userMessage });

  const response = await anthropic.messages.create({
    model: config.anthropicModel,
    max_tokens: 1024,
    system,
    messages: history,
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  history.push({ role: "assistant", content: text });
  return text;
}

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   DevAssistant — Documentación TaskFlow  ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log('\nEscribe tu pregunta o "salir" para terminar.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = () => {
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
        const reply = await chat(msg);
        console.log(`\nAsistente: ${reply}\n`);
      } catch (err) {
        console.error("Error:", err instanceof Error ? err.message : err);
      }

      ask();
    });
  };

  ask();
}

main().catch(console.error);
