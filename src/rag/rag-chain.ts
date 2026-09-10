import type { RetrievedChunk } from "../types.js";

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
