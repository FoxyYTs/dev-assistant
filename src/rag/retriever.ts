import { config } from "../config.js";
import type { RetrievedChunk } from "../types.js";
import { generateEmbedding } from "./embeddings.js";
import { VectorStore } from "./vector-store.js";

// Se reutiliza una sola conexión entre búsquedas; resetStore() la cierra
// para que la siguiente búsqueda vea lo que dejó un /ingest nuevo.
let store: VectorStore | null = null;

function getStore(): VectorStore {
  store ??= new VectorStore(config.dbPath);
  return store;
}

/** Busca en el vector store los chunks más relevantes para la pregunta. */
export async function retrieveContext(
  query: string,
  topK: number = config.ragTopK,
): Promise<RetrievedChunk[]> {
  const vectorStore = getStore();
  if (vectorStore.size === 0) return [];

  const queryEmbedding = await generateEmbedding(query);
  return vectorStore
    .search(queryEmbedding, topK)
    .map((result) => ({ ...result.chunk, score: result.score }));
}

export function resetStore(): void {
  store?.close();
  store = null;
}
