import Anthropic from "@anthropic-ai/sdk";
import { client } from "../llm/anthropic-client.js";
import { config } from "../config.js";
import { AGENT_SYSTEM_PROMPT } from "./system-prompt.js";
import { TOOL_DEFINITIONS } from "../tools/definitions.js";
import { executeTool } from "../tools/executor.js";
import type { AgentResponse } from "../types.js";

const MAX_TOOL_CALLS = 8;
const MAX_ITERATIONS = 10;

function toAnthropicTools(): Anthropic.Messages.Tool[] {
  return TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Messages.Tool["input_schema"],
  }));
}

/**
 * Agente conversacional con loop agentic (tool_use) y memoria de la sesión.
 * Limita a MAX_TOOL_CALLS llamadas a herramientas por turno de usuario para
 * evitar que una tarea mal planteada entre en un ciclo costoso.
 */
export class DevAssistantAgent {
  private messages: Anthropic.Messages.MessageParam[] = [];
  private toolCallsLastTurn = 0;

  /**
   * Procesa un turno del usuario. Si se pasa `onChunk`, el texto de Claude se
   * entrega fragmento a fragmento a medida que llega (streaming).
   */
  async chat(
    userMessage: string,
    onChunk?: (fragment: string) => void,
  ): Promise<AgentResponse> {
    this.messages.push({ role: "user", content: userMessage });
    this.toolCallsLastTurn = 0;

    const toolsUsed: string[] = [];
    let inputTokensThisTurn = 0;
    let outputTokensThisTurn = 0;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const stream = client.messages.stream({
        model: config.anthropicModel,
        max_tokens: 4096,
        system: AGENT_SYSTEM_PROMPT,
        tools: toAnthropicTools(),
        messages: this.messages,
      });
      if (onChunk) stream.on("text", onChunk);
      const response = await stream.finalMessage();

      inputTokensThisTurn += response.usage.input_tokens;
      outputTokensThisTurn += response.usage.output_tokens;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );

      // Verifica límite ANTES de ejecutar para el caso tool_use.
      if (this.toolCallsLastTurn + toolUseBlocks.length > MAX_TOOL_CALLS) {
        console.warn(
          `Límite de ${MAX_TOOL_CALLS} tool calls alcanzado en este turno`,
        );
        const limitMessage =
          `He alcanzado el límite de ${MAX_TOOL_CALLS} llamadas a herramientas por turno. ` +
          `Para completar esta tarea, intenta dividirla en preguntas más específicas.`;

        this.messages.push({
          role: "assistant",
          content: limitMessage,
        });

        return {
          text: limitMessage,
          toolsUsed,
          inputTokens: inputTokensThisTurn,
          outputTokens: outputTokensThisTurn,
        };
      }

      if (response.stop_reason === "tool_use") {
        this.messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          this.toolCallsLastTurn++;
          toolsUsed.push(block.name);

          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
          );

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }

        this.messages.push({ role: "user", content: toolResults });
        continue;
      }

      const textBlock = response.content.find((b) => b.type === "text");
      const text = textBlock?.type === "text" ? textBlock.text : "";
      this.messages.push({ role: "assistant", content: response.content });

      return {
        text,
        toolsUsed,
        inputTokens: inputTokensThisTurn,
        outputTokens: outputTokensThisTurn,
      };
    }

    const timeoutMessage =
      "No pude completar la tarea en el número máximo de iteraciones. Intenta reformular la pregunta.";

    return {
      text: timeoutMessage,
      toolsUsed,
      inputTokens: inputTokensThisTurn,
      outputTokens: outputTokensThisTurn,
    };
  }

  clearHistory(): void {
    this.messages = [];
    this.toolCallsLastTurn = 0;
  }

  getHistoryLength(): number {
    return this.messages.length;
  }
}
