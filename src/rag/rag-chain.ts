import { streamClaudeWithCallback } from "../llm/streaming.js";
import type { RetrievedChunk } from "../types.js";
import { retrieveContext } from "./retriever.js";

export const RAG_SYSTEM_PROMPT = `Eres DevAssistant, un asistente de documentación técnica.
Tu trabajo es responder preguntas basándote ÚNICAMENTE en la documentación que se te proporciona como contexto.

Reglas importantes:
1. Si la información está en el contexto: responde citando la fuente (nombre del archivo y sección)
2. Si la información NO está en el contexto: di claramente "No tengo esa información en la documentación disponible"
3. Nunca inventes datos técnicos, versiones, endpoints, o configuraciones
4. Usa markdown para formatear tu respuesta (código, listas, encabezados)
5. Sé conciso y directo — los developers prefieren respuestas específicas`;

export function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (chunk) =>
        `[FUENTE: ${chunk.metadata.source} | Sección: ${chunk.metadata.heading}]\n${chunk.content}`,
    )
    .join("\n\n---\n\n");
}

/**
 * Construye el prompt aumentado con el contexto recuperado del RAG y la
 * pregunta del usuario, listo para enviarse a Claude junto con RAG_SYSTEM_PROMPT.
 */
export function buildAugmentedPrompt(
  chunks: RetrievedChunk[],
  question: string,
): string {
  return `Contexto recuperado de la documentación:
---
${formatContext(chunks)}
---

Basándote ÚNICAMENTE en el contexto anterior, responde la siguiente pregunta.
Si la información no está en el contexto, indica claramente que no tienes esa información.
Cita la fuente (nombre del archivo y sección) cuando sea posible.

Pregunta: ${question}`;
}

/**
 * Pipeline RAG completo: recupera los chunks relevantes, arma el prompt
 * aumentado y responde con Claude en streaming (vía `onChunk`).
 */
export async function askWithRAG(
  question: string,
  onChunk: (textChunk: string) => void = () => undefined,
): Promise<string> {
  const chunks = await retrieveContext(question);

  if (chunks.length === 0) {
    const message =
      "No hay documentación en el vector store. Ejecuta `npm run ingest` primero.";
    onChunk(message);
    return message;
  }

  const sources = [
    ...new Set(chunks.map((c) => `${c.metadata.source} (${c.metadata.heading})`)),
  ];
  console.log("\n📚 Contexto recuperado de:");
  for (const source of sources) console.log(`   → ${source}`);
  console.log("");

  return streamClaudeWithCallback(
    buildAugmentedPrompt(chunks, question),
    onChunk,
    RAG_SYSTEM_PROMPT,
  );
}
