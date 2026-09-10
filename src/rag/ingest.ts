import { readdir, readFile } from "fs/promises";
import { join, extname } from "path";
import Database from "better-sqlite3";
import OpenAI from "openai";
import { config } from "../config.js";
import type { Chunk } from "../types.js";

const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 50;

type RawChunk = Omit<Chunk, "id"> & { id: string };

function extractHeading(text: string): string {
  const match = text.match(/^#+\s+(.+)/m);
  return match?.[1]?.trim() ?? "";
}

function splitIntoChunks(text: string, source: string): RawChunk[] {
  const words = text.split(/\s+/);
  const chunks: RawChunk[] = [];

  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const content = words.slice(i, i + CHUNK_SIZE).join(" ");
    if (content.trim().length > 10) {
      chunks.push({
        id: `${source}-chunk-${i}`,
        content,
        metadata: {
          source,
          heading: extractHeading(content),
          position: i,
          charCount: content.length,
        },
      });
    }
  }

  return chunks;
}

async function generateEmbedding(text: string, client: OpenAI): Promise<number[]> {
  const response = await client.embeddings.create({
    model: config.openaiEmbeddingModel,
    input: text,
  });
  const embedding = response.data[0]?.embedding;
  if (!embedding) throw new Error("No embedding returned");
  return embedding;
}

export async function ingestDocs(
  docsPath: string = config.docsPath,
): Promise<{ files: number; chunks: number }> {
  console.log(`=== RAG Ingest (${docsPath}) ===\n`);

  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY no configurada en .env");
  }

  const openai = new OpenAI({ apiKey: config.openaiApiKey });
  const db = new Database(config.dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id        TEXT PRIMARY KEY,
      content   TEXT NOT NULL,
      source    TEXT NOT NULL,
      heading   TEXT NOT NULL,
      position  INTEGER NOT NULL,
      char_count INTEGER NOT NULL,
      embedding TEXT NOT NULL
    )
  `);
  db.exec("DELETE FROM chunks");

  const files = await readdir(docsPath);
  const mdFiles = files.filter((f) => extname(f) === ".md");

  const insert = db.prepare(`
    INSERT INTO chunks (id, content, source, heading, position, char_count, embedding)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let totalChunks = 0;

  for (const file of mdFiles) {
    const filePath = join(docsPath, file);
    const content = await readFile(filePath, "utf-8");
    const chunks = splitIntoChunks(content, file);

    process.stdout.write(`Procesando ${file}: ${chunks.length} chunks `);

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content, openai);
      insert.run(
        chunk.id,
        chunk.content,
        chunk.metadata.source,
        chunk.metadata.heading,
        chunk.metadata.position,
        chunk.metadata.charCount,
        JSON.stringify(embedding)
      );
      process.stdout.write(".");
    }

    totalChunks += chunks.length;
    console.log(" ✓");
  }

  db.close();
  console.log(
    `\n✓ Ingestion completada: ${mdFiles.length} archivos, ${totalChunks} chunks indexados.`
  );

  return { files: mdFiles.length, chunks: totalChunks };
}

// Permite seguir usando `npm run ingest` como script standalone. Al importar
// ingestDocs() desde otro módulo (ej: el comando /ingest de la CLI) este
// bloque no se ejecuta, porque process.argv[1] apunta al script que sí se
// invocó directamente (tsx), no a este archivo.
if (process.argv[1]?.endsWith("ingest.ts")) {
  ingestDocs().catch(console.error);
}
