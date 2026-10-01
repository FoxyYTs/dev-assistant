import { client } from "./anthropic-client.js";
import { config } from "../config.js";

/**
 * Envía un prompt a Claude e imprime cada fragmento de texto en la terminal
 * a medida que llega. Devuelve el texto completo acumulado al finalizar.
 */
export async function streamClaude(
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const fullResponse = await streamClaudeWithCallback(
    prompt,
    (textChunk) => process.stdout.write(textChunk),
    systemPrompt,
  );
  process.stdout.write("\n");
  return fullResponse;
}

/**
 * Envía un prompt a Claude y procesa cada fragmento de texto a medida que llega,
 * de forma personalizada mediante `onChunk` (por ejemplo, para imprimirlo en la
 * terminal en tiempo real). Devuelve el texto completo acumulado al finalizar.
 */
export async function streamClaudeWithCallback(
  prompt: string,
  onChunk: (textChunk: string) => void,
  systemPrompt?: string,
): Promise<string> {
  let fullResponse = "";

  const responseStream = client.messages.stream({
    model: config.anthropicModel,
    max_tokens: 1024,
    ...(systemPrompt && { system: systemPrompt }),
    messages: [{ role: "user", content: prompt }],
  });

  responseStream.on("text", (textChunk) => {
    onChunk(textChunk);
    fullResponse += textChunk;
  });

  await responseStream.finalMessage();
  return fullResponse;
}
