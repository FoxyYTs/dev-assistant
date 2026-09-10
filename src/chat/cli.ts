import * as readline from "readline";
import { config } from "../config.js";
import { DevAssistantAgent } from "../agent/agent.js";
import { ConversationManager } from "./conversation.js";
import { TOOL_DEFINITIONS } from "../tools/definitions.js";
import { checkGuardrails, createRateLimiter } from "../security/guardrails.js";
import { calculateCost, formatCostUSD } from "../utils/cost-calculator.js";

const agent = new DevAssistantAgent();
const conversation = new ConversationManager();
const rateLimiter = createRateLimiter();

function printBanner(): void {
  console.log("╔════════════════════════════════════════╗");
  console.log("║         DevAssistant v1.0              ║");
  console.log("║    Agente de Documentación y Código    ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");
  console.log("💬 Escribe tu pregunta y presiona Enter.");
  console.log("💡 Tip: usa /ingest para cargar documentación");
  console.log("   Comandos: /ingest [path],");
  console.log("             /clear, /stats, /tools, /exit");
  console.log("");
}

function printSessionSummary(): void {
  const stats = conversation.getStats();
  const cost = calculateCost(
    config.anthropicModel,
    stats.totalInputTokens,
    stats.totalOutputTokens,
  );
  console.log(
    `   Resumen: ${stats.turns} turnos, costo estimado ${formatCostUSD(cost.totalCostUSD)} (modelo: ${config.anthropicModel})\n`,
  );
}

async function main(): Promise<void> {
  printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let closed = false;
  rl.on("close", () => {
    closed = true;
  });

  const promptUser = (): void => {
    if (closed) return; // evita ERR_USE_AFTER_CLOSE si stdin llega a EOF (ej: input por pipe)

    rl.question("Tú: ", async (raw) => {
      const userInput = raw.trim();

      if (!userInput) {
        promptUser();
        return;
      }

      const [command, ...rest] = userInput.split(" ");
      const arg = rest.join(" ").trim();

      if (command === "/exit") {
        console.log(`\n👋 ¡Hasta luego!`);
        printSessionSummary();
        rl.close();
        return;
      }

      if (command === "/clear") {
        agent.clearHistory();
        conversation.reset();
        console.log("\n🧹 Historial de conversación reiniciado.\n");
        promptUser();
        return;
      }

      if (command === "/tools") {
        console.log(`\nTools disponibles (${TOOL_DEFINITIONS.length}):`);
        for (const tool of TOOL_DEFINITIONS) {
          const params = Object.keys(tool.input_schema.properties).join(", ");
          console.log(`   • ${tool.name}(${params})`);
          console.log(`     ${tool.description.split(".")[0]}.`);
        }
        console.log("");
        promptUser();
        return;
      }

      if (command === "/stats") {
        const stats = conversation.getStats();
        const cost = calculateCost(
          config.anthropicModel,
          stats.totalInputTokens,
          stats.totalOutputTokens,
        );
        console.log(`\n📊 Estadísticas de la conversación:`);
        console.log(`   • Turnos: ${stats.turns}`);
        console.log(`   • Tokens de entrada acumulados: ${stats.totalInputTokens}`);
        console.log(`   • Tokens de salida acumulados: ${stats.totalOutputTokens}`);
        console.log(`   • Tokens estimados en contexto actual: ${stats.estimatedContextTokens}`);
        console.log(`   • Costo estimado de la sesión: ${formatCostUSD(cost.totalCostUSD)}\n`);
        promptUser();
        return;
      }

      if (command === "/ingest") {
        const path = arg || config.docsPath;
        try {
          console.log(`\n📚 Indexando documentación en ${path}...`);
          const { ingestDocs } = await import("../rag/ingest.js");
          const result = await ingestDocs(path);
          console.log(`✓ ${result.files} archivos, ${result.chunks} chunks indexados.\n`);
        } catch (err) {
          console.error(
            "Error durante la ingestión:",
            err instanceof Error ? err.message : err,
          );
        }
        promptUser();
        return;
      }

      // Cualquier otro texto se envía al agente, pasando primero por los guardrails.
      const guardrailResult = checkGuardrails(userInput, rateLimiter);

      if (!guardrailResult.safe) {
        console.log(`\n⚠️  ${guardrailResult.reason}\n`);
        promptUser();
        return;
      }

      try {
        const response = await agent.chat(guardrailResult.sanitized);
        conversation.recordTurn(response.inputTokens, response.outputTokens);

        console.log(`\nDevAssistant: ${response.text}\n`);
        if (response.toolsUsed.length > 0) {
          console.log(`   (herramientas usadas: ${response.toolsUsed.join(", ")})\n`);
        }
      } catch (err) {
        console.error("Error:", err instanceof Error ? err.message : err);
      }

      promptUser();
    });
  };

  promptUser();
}

main().catch(console.error);
