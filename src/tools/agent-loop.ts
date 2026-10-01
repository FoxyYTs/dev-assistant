import Anthropic from "@anthropic-ai/sdk";
import { client } from "../llm/anthropic-client.js";
import { config } from "../config.js";
import { TOOL_DEFINITIONS } from "./definitions.js";
import { executeTool } from "./executor.js";
import type { ToolDefinition } from "../types.js";

const MAX_ITERATIONS = 10;

/**
 * Agentic loop básico (sección 4): envía el prompt con las tools disponibles y,
 * mientras Claude responda con `tool_use`, ejecuta las tools y le devuelve los
 * resultados, hasta que termine con `end_turn` o se alcance MAX_ITERATIONS.
 *
 * Es una sola pregunta sin memoria entre llamadas; DevAssistantAgent
 * (src/agent/agent.ts) extiende esta idea con historial y límite de tool calls.
 */
export async function runWithTools(
  prompt: string,
  systemPrompt?: string,
  tools: ToolDefinition[] = TOOL_DEFINITIONS,
): Promise<string> {
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: prompt },
  ];
  const sdkTools = tools as Anthropic.Messages.Tool[];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    console.log(`\n🤔 Pensando... (iteración ${iteration + 1})`);

    const response = await client.messages.create({
      model: config.anthropicModel,
      max_tokens: 4096,
      ...(systemPrompt && { system: systemPrompt }),
      tools: sdkTools,
      messages,
    });

    const textOf = (content: Anthropic.Messages.ContentBlock[]): string =>
      content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

    if (response.stop_reason === "end_turn") {
      console.log("✓ Respuesta final generada\n");
      return textOf(response.content);
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );

      // Las tools de un mismo turno son independientes: se ejecutan en paralelo.
      const results = await Promise.all(
        toolUseBlocks.map(async (block) => {
          console.log(`🔧 Ejecutando tool: ${block.name} ${JSON.stringify(block.input)}`);
          const output = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
          );
          console.log(`   ✓ ${block.name} completada`);
          return output;
        }),
      );

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] =
        toolUseBlocks.map((block, i) => ({
          type: "tool_result",
          tool_use_id: block.id,
          content: results[i] ?? "Error: resultado vacío",
        }));

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    console.warn(`⚠️  Stop reason inesperado: ${response.stop_reason ?? "desconocido"}`);
    return (
      textOf(response.content) ||
      `Sesión terminada: ${response.stop_reason ?? "razón desconocida"}`
    );
  }

  console.warn(`⚠️  Límite de ${MAX_ITERATIONS} iteraciones alcanzado`);
  return (
    `Lo siento, no pude completar la tarea en ${MAX_ITERATIONS} iteraciones. ` +
    `Intenta una pregunta más específica.`
  );
}
