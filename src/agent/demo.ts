import Anthropic from "@anthropic-ai/sdk";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { config } from "../config.js";
import type { Issue } from "../types.js";

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

// --- Tool definitions ---

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "create_issue",
    description:
      "Crea un issue/ticket en el sistema de seguimiento de problemas y lo guarda localmente.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Título conciso del issue" },
        body: {
          type: "string",
          description: "Descripción detallada del problema y pasos para reproducirlo",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Etiquetas: bug, feature, docs, performance, security",
        },
      },
      required: ["title", "body"],
    },
  },
  {
    name: "search_docs",
    description: "Busca información en la documentación técnica de TaskFlow API.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Términos de búsqueda" },
        section: {
          type: "string",
          description: "Sección específica: auth, tasks, projects, rate-limiting, webhooks, pagination",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "check_rate_limit",
    description:
      "Evalúa si una operación puede exceder el rate limit de la API (100 req/min).",
    input_schema: {
      type: "object" as const,
      properties: {
        requests_per_minute: {
          type: "number",
          description: "Número estimado de requests por minuto",
        },
        operation: {
          type: "string",
          description: "Descripción de la operación",
        },
      },
      required: ["requests_per_minute", "operation"],
    },
  },
];

// --- Tool handlers ---

async function handleTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "create_issue": {
      const issue: Issue = {
        id: `ISS-${randomUUID().slice(0, 8).toUpperCase()}`,
        title: input["title"] as string,
        body: input["body"] as string,
        labels: (input["labels"] as string[] | undefined) ?? [],
        createdAt: new Date().toISOString(),
      };

      await mkdir("./issues", { recursive: true });
      const path = join("./issues", `${issue.id}.json`);
      await writeFile(path, JSON.stringify(issue, null, 2));

      return JSON.stringify({
        success: true,
        issue_id: issue.id,
        message: `Issue creado: "${issue.title}" (${issue.id})`,
        saved_to: path,
      });
    }

    case "search_docs": {
      const query = input["query"] as string;
      const section = (input["section"] as string | undefined) ?? "general";

      const docMap: Record<string, string> = {
        auth: "Autenticación con Bearer JWT. Access token: 15min, Refresh token: 7 días. Renovar con POST /auth/refresh.",
        tasks: "CRUD en /tasks. Campos: id, title, description, status, priority, dueDate, tags. Paginación cursor-based.",
        "rate-limiting": "Límite: 100 req/minuto por usuario. Header Retry-After indica segundos a esperar en 429.",
        pagination: "Cursor-based. Usar nextCursor de la respuesta. hasMore indica si hay más páginas.",
        webhooks: "Eventos: task.created, task.updated, task.completed, task.deleted, project.member.added. Verificar HMAC-SHA256.",
        projects: "Proyectos con miembros y roles: owner, admin, member, viewer.",
        general: "TaskFlow es una REST API para gestión de tareas. Base URL: https://api.taskflow.app/v1",
      };

      const info = docMap[section] ?? docMap["general"]!;

      return JSON.stringify({
        query,
        section,
        result: info,
        hint: `Para más detalle, consulta docs/sample-project/ — relevante para: "${query}"`,
      });
    }

    case "check_rate_limit": {
      const rpm = input["requests_per_minute"] as number;
      const operation = input["operation"] as string;
      const limit = 100;
      const exceeds = rpm > limit;

      return JSON.stringify({
        operation,
        requests_per_minute: rpm,
        rate_limit: limit,
        exceeds: exceeds,
        margin: exceeds ? rpm - limit : limit - rpm,
        recommendation: exceeds
          ? `ADVERTENCIA: "${operation}" excede el rate limit (${rpm} > ${limit} req/min). Implementa throttling, batching o caché.`
          : `OK: "${operation}" está dentro del límite (${rpm}/${limit} req/min).`,
      });
    }

    default:
      return JSON.stringify({ error: `Tool desconocida: ${name}` });
  }
}

// --- Agentic loop ---

async function runAgent(userRequest: string): Promise<void> {
  console.log(`\nUsuario: ${userRequest}\n`);

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userRequest },
  ];

  const MAX_ITER = 10;

  for (let i = 0; i < MAX_ITER; i++) {
    const response = await anthropic.messages.create({
      model: config.anthropicModel,
      max_tokens: 4096,
      system: `Eres un agente técnico experto en TaskFlow API.
Analiza los problemas del usuario usando las herramientas disponibles.
Cuando detectes un problema, crea un issue con create_issue.
Responde siempre en español.`,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content.find((c) => c.type === "text");
      if (text?.type === "text") {
        console.log(`Agente: ${text.text}`);
      }
      break;
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`  [tool] ${block.name}(${JSON.stringify(block.input)})`);

          const result = await handleTool(
            block.name,
            block.input as Record<string, unknown>
          );

          console.log(`  [result] ${result}\n`);

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }
  }
}

// --- Scenarios ---

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║    Agente con Function Calling — Demo    ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const scenarios = [
    "Estoy haciendo 150 requests por minuto al endpoint GET /tasks para sincronizar datos en tiempo real. ¿Hay algún problema?",
    "¿Cómo funciona la autenticación JWT en TaskFlow? ¿Qué pasa cuando expira el access token?",
  ];

  for (const scenario of scenarios) {
    console.log(`\n${"═".repeat(60)}`);
    await runAgent(scenario);
    console.log(`${"═".repeat(60)}`);
  }
}

main().catch(console.error);
