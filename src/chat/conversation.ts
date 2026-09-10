export interface ConversationStats {
  turns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedContextTokens: number;
}

/** Lleva el conteo de turnos y tokens de la sesión actual para /stats. */
export class ConversationManager {
  private turns = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  recordTurn(inputTokens: number, outputTokens: number): void {
    this.turns++;
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
  }

  getStats(): ConversationStats {
    return {
      turns: this.turns,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      // Estimación: como el historial completo se reenvía en cada turno,
      // la suma acumulada de tokens es una buena aproximación del contexto actual.
      estimatedContextTokens: this.totalInputTokens + this.totalOutputTokens,
    };
  }

  reset(): void {
    this.turns = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
  }
}
