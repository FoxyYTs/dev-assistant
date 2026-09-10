import Database from "better-sqlite3";
import OpenAI from "openai";
import { config } from "../config.js";
import type { Chunk, SearchResult } from "../types.js";

interface ChunkRow {
  id: string;
  content: string;
  source: string;
  heading: string;
  position: number;
  char_count: number;
  embedding: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

export async function queryDocuments(
  query: string,
  openai: OpenAI
): Promise<SearchResult[]> {
  const db = new Database(config.dbPath, { readonly: true });

  const embeddingResponse = await openai.embeddings.create({
    model: config.openaiEmbeddingModel,
    input: query,
  });
  const queryVector = embeddingResponse.data[0]?.embedding;
  if (!queryVector) throw new Error("No embedding returned for query");

  const rows = db
    .prepare("SELECT id, content, source, heading, position, char_count, embedding FROM chunks")
    .all() as ChunkRow[];

  db.close();

  const results: SearchResult[] = rows.map((row) => {
    const chunk: Chunk = {
      id: row.id,
      content: row.content,
      metadata: {
        source: row.source,
        heading: row.heading,
        position: row.position,
        charCount: row.char_count,
      },
    };
    return {
      chunk,
      score: cosineSimilarity(queryVector, JSON.parse(row.embedding) as number[]),
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, config.ragTopK);
}
