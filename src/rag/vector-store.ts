import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { Chunk, SearchResult } from "../types.js";

interface SearchRow {
  id: string;
  content: string;
  source: string;
  heading: string;
  position: number;
  char_count: number;
  distance: number;
}

/** sqlite-vec guarda los vectores como un blob de float32. */
function serializeEmbedding(embedding: number[]): Buffer {
  return Buffer.from(new Float32Array(embedding).buffer);
}

/**
 * Vector store sobre SQLite + sqlite-vec. Los chunks van en una tabla normal
 * y sus embeddings en una tabla virtual `vec0`, que hace la búsqueda por
 * similitud dentro de la base de datos.
 */
export class VectorStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    sqliteVec.load(this.db);
    this.db.pragma("journal_mode = WAL");
  }

  private hasEmbeddingsTable(): boolean {
    const row = this.db
      .prepare("SELECT name FROM sqlite_master WHERE name = 'chunk_embeddings'")
      .get();
    return row !== undefined;
  }

  /**
   * Borra y recrea las tablas. La dimensión del vector depende del modelo de
   * embeddings (1536 para text-embedding-3-small), así que se recibe aquí.
   */
  reset(dimensions: number): void {
    this.db.exec("DROP TABLE IF EXISTS chunk_embeddings");
    this.db.exec("DROP TABLE IF EXISTS chunks");
    this.db.exec(`
      CREATE TABLE chunks (
        id         TEXT PRIMARY KEY,
        content    TEXT NOT NULL,
        source     TEXT NOT NULL,
        heading    TEXT NOT NULL,
        position   INTEGER NOT NULL,
        char_count INTEGER NOT NULL
      )
    `);
    this.db.exec(`
      CREATE VIRTUAL TABLE chunk_embeddings USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding float[${dimensions}] distance_metric=cosine
      )
    `);
  }

  insertMany(items: Array<{ chunk: Chunk; embedding: number[] }>): void {
    const insertChunk = this.db.prepare(`
      INSERT INTO chunks (id, content, source, heading, position, char_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertEmbedding = this.db.prepare(
      "INSERT INTO chunk_embeddings (chunk_id, embedding) VALUES (?, ?)",
    );

    this.db.transaction(() => {
      for (const { chunk, embedding } of items) {
        insertChunk.run(
          chunk.id,
          chunk.content,
          chunk.metadata.source,
          chunk.metadata.heading,
          chunk.metadata.position,
          chunk.metadata.charCount,
        );
        insertEmbedding.run(chunk.id, serializeEmbedding(embedding));
      }
    })();
  }

  /** Retorna los topK chunks más similares; score = similitud coseno (0..1). */
  search(queryEmbedding: number[], topK: number): SearchResult[] {
    if (!this.hasEmbeddingsTable()) return [];

    const rows = this.db
      .prepare(`
        SELECT c.id, c.content, c.source, c.heading, c.position, c.char_count, e.distance
        FROM chunk_embeddings e
        JOIN chunks c ON c.id = e.chunk_id
        WHERE e.embedding MATCH ? AND k = ?
        ORDER BY e.distance
      `)
      .all(serializeEmbedding(queryEmbedding), topK) as SearchRow[];

    return rows.map((row) => ({
      chunk: {
        id: row.id,
        content: row.content,
        metadata: {
          source: row.source,
          heading: row.heading,
          position: row.position,
          charCount: row.char_count,
        },
      },
      score: 1 - row.distance,
    }));
  }

  get size(): number {
    if (!this.hasEmbeddingsTable()) return 0;
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM chunks").get() as {
      count: number;
    };
    return row.count;
  }

  close(): void {
    this.db.close();
  }
}
