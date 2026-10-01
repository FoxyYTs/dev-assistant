// Uso: npm run review <ruta-del-archivo>
// Ejemplo: npm run review ./src/config.ts
// Ejemplo con el fragmento del curso: npm run review ./examples/codigo-con-problemas.js

import * as fs from "fs";
import * as path from "path";
import { streamClaude } from "../llm/streaming.js";
import { CODE_REVIEWER_PROMPT } from "../llm/prompts.js";

// Extensiones de archivo que soportamos
const SUPPORTED_FILE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go",
  ".rs", ".java", ".cs", ".cpp", ".c", ".rb",
  ".php", ".swift", ".kt", ".sql",
]);
// Límite de tamaño: archivos muy grandes consumen muchos tokens
const MAX_CHARS = 20_000;

async function reviewFile(filePath: string): Promise<void> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Archivo no encontrado: ${absolutePath}`);
    process.exit(1);
  }

  const extension = path.extname(absolutePath).toLowerCase();
  if (!SUPPORTED_FILE_EXTENSIONS.has(extension)) {
    console.warn(
      `⚠️  Extensión "${extension}" no reconocida. Continuando de todas formas...`,
    );
  }

  const content = fs.readFileSync(absolutePath, "utf-8");
  const totalLines = content.split("\n").length;
  const fileName = path.basename(absolutePath);

  let contenidoARevisar = content;
  let sizeWarning = "";

  if (content.length > MAX_CHARS) {
    contenidoARevisar = content.slice(0, MAX_CHARS);
    sizeWarning = `⚠️  Archivo muy grande — revisando los primeros ${MAX_CHARS} caracteres`;
  }

  // Mostrar header
  console.log("╔════════════════════════════════════════╗");
  console.log("║       DevAssistant — Code Reviewer     ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`\n📄 Archivo: ${fileName}`);
  console.log(`   Ruta: ${absolutePath}`);
  console.log(`   Líneas: ${totalLines} | Caracteres: ${content.length}`);
  if (sizeWarning) console.log(sizeWarning);
  console.log("\nAnalizando con Claude...\n");
  console.log("─".repeat(60));

  // Construir el prompt con el contexto del archivo
  const prompt = `Por favor, revisa el siguiente archivo de código:

**Archivo:** \`${fileName}\`
**Extensión:** ${extension || "desconocida"}
**Líneas:** ${totalLines}

\`\`\`${extension.slice(1)}
${contenidoARevisar}
\`\`\``;

  await streamClaude(prompt, CODE_REVIEWER_PROMPT);

  console.log("─".repeat(60));
  console.log("✓ Review completada.");
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("Uso: npm run review <ruta-del-archivo>");
  console.error("Ejemplo: npm run review ./src/config.ts");
  process.exit(1);
}

reviewFile(filePath).catch((error: Error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
