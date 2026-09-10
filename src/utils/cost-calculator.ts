// USD por 1 millón de tokens (precios a mayo 2026)
// https://platform.claude.com/docs/en/about-claude/pricing y https://developers.openai.com/api/docs/pricing
// Actualizar PRICING cuando Anthropic/OpenAI los modifiquen.
export const PRICING: Record<string, { input: number; output: number }> = {
  // Claude models (Anthropic)
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 5.0, output: 25.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  // GPT models (OpenAI)
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  // Embeddings (costo solo en input — no generan output)
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
};

export interface CostBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCostUSD: number;
  outputCostUSD: number;
  totalCostUSD: number;
}

/** Estima el costo en USD de una llamada (o sesión acumulada) según el modelo usado. */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): CostBreakdown {
  const rates = PRICING[model];
  if (!rates) {
    throw new Error(`Modelo desconocido en tabla de precios: ${model}`);
  }

  const inputCostUSD = (inputTokens / 1_000_000) * rates.input;
  const outputCostUSD = (outputTokens / 1_000_000) * rates.output;

  return {
    model,
    inputTokens,
    outputTokens,
    inputCostUSD,
    outputCostUSD,
    totalCostUSD: inputCostUSD + outputCostUSD,
  };
}

export function formatCostUSD(amount: number): string {
  return `$${amount.toFixed(4)}`;
}
