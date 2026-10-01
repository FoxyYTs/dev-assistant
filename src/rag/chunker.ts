import { readdir, readFile } from "fs/promises";
import { basename, join } from "path";
import type { Chunk } from "../types.js";

const MAX_CHUNK_SIZE = 2000;
const INTRO_HEADING = "(Introducción)";

function makeChunk(
  content: string,
  source: string,
  heading: string,
  position: number,
): Chunk {
  return {
    id: `${source}-${position}`,
    content,
    metadata: { source, heading, position, charCount: content.length },
  };
}

/**
 * Divide un documento Markdown en chunks semánticos: una sección `## ` por
 * chunk. Si una sección supera MAX_CHUNK_SIZE se parte por párrafos, cada
 * parte lleva el título de su sección y repite el último párrafo de la parte
 * anterior (overlap) para no perder contexto en el corte.
 */
export function chunkMarkdown(content: string, filePath: string): Chunk[] {
  const source = basename(filePath);
  const chunks: Chunk[] = [];

  for (const section of content.split(/(?=^## )/m)) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const firstLine = trimmed.split("\n")[0] ?? "";
    const isHeading = firstLine.startsWith("## ");
    const heading = isHeading ? firstLine.replace(/^##\s+/, "").trim() : INTRO_HEADING;

    if (trimmed.length <= MAX_CHUNK_SIZE) {
      chunks.push(makeChunk(trimmed, source, heading, chunks.length));
      continue;
    }

    // Sección larga: se arma por párrafos sin repetir el título en el cuerpo,
    // porque se antepone a cada parte.
    const body = isHeading ? trimmed.slice(firstLine.length) : trimmed;
    const paragraphs = body.split(/\n\n+/).filter((p) => p.trim().length > 0);
    const prefix = isHeading ? `${firstLine}\n\n` : "";

    let current: string[] = [];
    const flush = (): void => {
      chunks.push(makeChunk(prefix + current.join("\n\n"), source, heading, chunks.length));
    };

    for (const paragraph of paragraphs) {
      const currentSize = prefix.length + current.join("\n\n").length;
      if (current.length > 0 && currentSize + paragraph.length > MAX_CHUNK_SIZE) {
        flush();
        current = [current[current.length - 1]!]; // overlap de un párrafo
      }
      current.push(paragraph.trim());
    }
    if (current.length > 0) flush();
  }

  return chunks;
}

/** Lee todos los archivos .md de un directorio y los convierte en chunks. */
export async function processDirectory(dirPath: string): Promise<Chunk[]> {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    throw new Error(`No se pudo leer el directorio: ${dirPath}`);
  }

  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const allChunks: Chunk[] = [];
  for (const file of markdownFiles) {
    const content = await readFile(join(dirPath, file), "utf-8");
    const chunks = chunkMarkdown(content, file);
    allChunks.push(...chunks);
    console.log(`Procesando ${file}... ${chunks.length} chunks generados`);
  }

  return allChunks;
}
