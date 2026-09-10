export const INJECTION_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  // --- Inglés ---
  {
    name: "ignore instructions",
    regex: /ignore\s+(?:\w+\s+){0,3}instructions?/i,
  },
  {
    name: "forget instructions",
    regex:
      /forget\s+(everything|all|your\s+instructions?|what\s+you\s+were\s+told)/i,
  },
  {
    name: "you are now",
    regex: /you\s+are\s+now\s+/i,
  },
  {
    name: "act as",
    regex: /act\s+as\s+(if\s+)?you\s+(are|were)\s+/i,
  },
  {
    name: "disregard",
    regex: /disregard\s+(your|all|previous|the)\s+/i,
  },
  {
    name: "new instructions",
    regex: /new\s+instructions?\s*:/i,
  },
  {
    name: "system override",
    regex: /system\s*:?\s*you\s+/i,
  },
  {
    name: "override system prompt",
    regex: /override\s+(the\s+)?(system\s+prompt|your\s+instructions?)/i,
  },

  // --- Español ---
  {
    name: "ignorar instrucciones (es)",
    regex:
      /ignora\s+(las\s+)?(instrucciones?\s+)?(anteriores?|previas?|todas?)/i,
  },
  {
    name: "olvida instrucciones (es)",
    regex:
      /olvida\s+(todo|las\s+instrucciones?|lo\s+que\s+te\s+(dijeron|indicaron))/i,
  },
  {
    name: "ahora eres (es)",
    regex: /ahora\s+(eres|serás|actúas?\s+como)\s+/i,
  },
  {
    name: "actúa como (es)",
    regex: /actúa\s+(como\s+si\s+)?(fueras?|eres)\s+/i,
  },
  {
    name: "nuevas instrucciones (es)",
    regex: /nuevas?\s+instrucciones?\s*:/i,
  },
  {
    name: "ignora todo (es)",
    regex: /ignora\s+todo\s+(lo\s+anterior|lo\s+que\s+)/i,
  },
  {
    name: "eres libre (es)",
    regex: /eres\s+libre\s+(de|para)\s+/i,
  },
  {
    name: "sin restricciones (es)",
    regex: /sin\s+(ninguna\s+)?(restricci[oó]n|l[ií]mite|instrucci[oó]n)/i,
  },
];

const MAX_INPUT_LENGTH = 8000;

/** Elimina null bytes, colapsa saltos de línea excesivos y trunca inputs muy largos. */
export function sanitizeInput(input: string): string {
  let sanitized = input.replace(/\0/g, "");
  sanitized = sanitized.replace(/\n{3,}/g, "\n\n");

  if (sanitized.length > MAX_INPUT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_INPUT_LENGTH);
  }

  return sanitized;
}

export interface InjectionResult {
  detected: boolean;
  pattern?: string;
}

/** Evalúa el input contra los patrones conocidos de prompt injection (inglés y español). */
export function detectPromptInjection(input: string): InjectionResult {
  for (const { name, regex } of INJECTION_PATTERNS) {
    if (regex.test(input)) {
      return { detected: true, pattern: name };
    }
  }
  return { detected: false };
}

export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimiter {
  check(): boolean;
}

/** Rate limiter simple de ventana deslizante en memoria (por proceso). */
export function createRateLimiter(
  options: RateLimiterOptions = { maxRequests: 30, windowMs: 60_000 },
): RateLimiter {
  const timestamps: number[] = [];

  return {
    check(): boolean {
      const now = Date.now();
      while (timestamps.length > 0 && timestamps[0]! <= now - options.windowMs) {
        timestamps.shift();
      }

      if (timestamps.length >= options.maxRequests) {
        return false;
      }

      timestamps.push(now);
      return true;
    },
  };
}

export interface GuardrailResult {
  safe: boolean;
  sanitized: string;
  reason?: string;
  pattern?: string;
}

/** Orquesta rate limiting + sanitización + detección de prompt injection en un solo paso. */
export function checkGuardrails(
  input: string,
  rateLimiter: RateLimiter,
): GuardrailResult {
  if (!rateLimiter.check()) {
    return {
      safe: false,
      sanitized: input,
      reason: "Rate limit excedido. Espera un momento antes de continuar.",
    };
  }

  const sanitized = sanitizeInput(input);
  const injection = detectPromptInjection(sanitized);

  if (injection.detected) {
    return {
      safe: false,
      sanitized,
      reason: "Posible intento de prompt injection detectado.",
      pattern: injection.pattern,
    };
  }

  return { safe: true, sanitized };
}
