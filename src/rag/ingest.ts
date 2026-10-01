import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { config } from "../config.js";
import { processDirectory } from "./chunker.js";
import { generateEmbeddings } from "./embeddings.js";
import { resetStore } from "./retriever.js";
import { VectorStore } from "./vector-store.js";

// Copia legible de los chunks (sin los vectores completos) para inspeccionar
// cómo quedó partida la documentación.
const PREVIEW_JSON = join(dirname(config.dbPath), "chunks-preview.json");

/** Pipeline de ingestión: Markdown → chunks → embeddings → vector store. */
export async function ingestDocs(
  docsPath: string = config.docsPath,
): Promise<{ files: number; chunks: number }> {
  console.log(`=== RAG Ingest (${docsPath}) ===\n`);

  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY no configurada en .env");
  }

  const chunks = await processDirectory(docsPath);
  if (chunks.length === 0) {
    console.log("No se encontraron archivos .md en el directorio.");
    return { files: 0, chunks: 0 };
  }

  console.log(`\nGenerando embeddings para ${chunks.length} chunks...`);
  const embeddings = await generateEmbeddings(chunks.map((c) => c.content));
  const dimensions = embeddings[0]?.length ?? 0;
  console.log(`✓ Embeddings generados (${dimensions} dimensiones c/u)`);

  await mkdir(dirname(PREVIEW_JSON), { recursive: true });
  const preview = chunks.map((chunk, i) => ({
    id: chunk.id,
    metadata: chunk.metadata,
    content: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "..." : ""),
    embeddingPreview: (embeddings[i] ?? []).slice(0, 5),
  }));
  await writeFile(PREVIEW_JSON, JSON.stringify(preview, null, 2), "utf-8");

  // Cierra la conexión que use el retriever antes de recrear las tablas.
  resetStore();
  const store = new VectorStore(config.dbPath);
  store.reset(dimensions);
  store.insertMany(chunks.map((chunk, i) => ({ chunk, embedding: embeddings[i]! })));
  const stored = store.size;
  store.close();

  const files = new Set(chunks.map((c) => c.metadata.source)).size;
  console.log(`✓ ${stored} chunks guardados en ${config.dbPath}`);
  console.log(`  Preview: ${PREVIEW_JSON}`);

  return { files, chunks: stored };
}

// Permite seguir usando `npm run ingest` como script standalone. Al importar
// ingestDocs() desde otro módulo (ej: el comando /ingest de la CLI) este
// bloque no se ejecuta, porque process.argv[1] apunta al script que sí se
// invocó directamente (tsx), no a este archivo.
if (process.argv[1]?.endsWith("ingest.ts")) {
  ingestDocs().catch((err: Error) => {
    console.error("Error durante la ingestión:", err.message);
    process.exit(1);
  });
}
