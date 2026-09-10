import { readdir, readFile, writeFile, mkdir, stat } from "fs/promises";
import { join, resolve, relative } from "path";
import OpenAI from "openai";
import { config } from "../config.js";
import { queryDocuments } from "../rag/query.js";
import type { Issue } from "../types.js";

const PROJECT_ROOT = process.cwd();
const openai = new OpenAI({ apiKey: config.openaiApiKey });

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "data"]);
const SEARCHABLE_EXT = /\.(ts|js|json|md)$/;

/**
 * Resuelve una ruta relativa dentro del proyecto y evita path traversal
 * (ej: "../../etc/passwd") — el input viene de lo que Claude decide pasarle
 * a la tool, así que no debe confiar en él ciegamente.
 */
function resolveSafePath(relPath: string): string {
  const target = resolve(PROJECT_ROOT, relPath || ".");
  const rel = relative(PROJECT_ROOT, target);

  if (rel.startsWith("..")) {
    throw new Error(`Ruta fuera del proyecto no permitida: ${relPath}`);
  }

  return target;
}

// --- list_files ---

async function listFilesRecursive(
  dir: string,
  depth: number,
  maxDepth: number,
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  let results: string[] = [];

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    const relPath = relative(PROJECT_ROOT, full);

    if (entry.isDirectory()) {
      results.push(`${relPath}/`);
      if (depth < maxDepth) {
        results = results.concat(
          await listFilesRecursive(full, depth + 1, maxDepth),
        );
      }
    } else {
      results.push(relPath);
    }
  }

  return results;
}

async function executeListFiles(input: Record<string, unknown>): Promise<string> {
  const path = (input["path"] as string | undefined) ?? ".";
  const recursive = (input["recursive"] as boolean | undefined) ?? false;
  const target = resolveSafePath(path);

  const files = await listFilesRecursive(target, 0, recursive ? 4 : 0);
  return JSON.stringify({ path, count: files.length, files });
}

// --- read_file ---

const MAX_READ_CHARS = 8000;

async function executeReadFile(input: Record<string, unknown>): Promise<string> {
  const path = input["path"] as string;
  const target = resolveSafePath(path);

  const info = await stat(target);
  if (info.isDirectory()) {
    return JSON.stringify({
      error: `"${path}" es un directorio, no un archivo. Usa list_files.`,
    });
  }

  const content = await readFile(target, "utf-8");
  const truncated = content.length > MAX_READ_CHARS;

  return JSON.stringify({
    path,
    content: truncated ? content.slice(0, MAX_READ_CHARS) : content,
    truncated,
    totalChars: content.length,
  });
}

// --- search_code ---

const MAX_SEARCH_RESULTS = 30;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function searchInDir(
  dir: string,
  pattern: RegExp,
  results: Array<{ file: string; line: number; text: string }>,
): Promise<void> {
  if (results.length >= MAX_SEARCH_RESULTS) return;

  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (results.length >= MAX_SEARCH_RESULTS) return;
    if (IGNORED_DIRS.has(entry.name)) continue;

    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      await searchInDir(full, pattern, results);
    } else if (SEARCHABLE_EXT.test(entry.name)) {
      const content = await readFile(full, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (results.length >= MAX_SEARCH_RESULTS) break;
        const line = lines[i]!;
        if (pattern.test(line)) {
          results.push({
            file: relative(PROJECT_ROOT, full),
            line: i + 1,
            text: line.trim(),
          });
        }
      }
    }
  }
}

async function executeSearchCode(input: Record<string, unknown>): Promise<string> {
  const patternStr = input["pattern"] as string;
  const path = (input["path"] as string | undefined) ?? "src";
  const target = resolveSafePath(path);

  // Búsqueda literal (no regex) — más segura y predecible cuando el patrón
  // lo genera el modelo a partir de la petición del usuario.
  const pattern = new RegExp(escapeRegex(patternStr), "i");

  const results: Array<{ file: string; line: number; text: string }> = [];
  await searchInDir(target, pattern, results);

  return JSON.stringify({ pattern: patternStr, matches: results.length, results });
}

// --- search_docs ---

async function executeSearchDocs(input: Record<string, unknown>): Promise<string> {
  const query = input["query"] as string;
  const topK = (input["top_k"] as number | undefined) ?? config.ragTopK;

  try {
    const results = await queryDocuments(query, openai);
    const top = results.slice(0, Math.min(topK, 10));

    return JSON.stringify({
      query,
      results: top.map((r) => ({
        source: r.chunk.metadata.source,
        heading: r.chunk.metadata.heading,
        content: r.chunk.content,
        score: r.score,
      })),
    });
  } catch (err) {
    return JSON.stringify({
      error:
        `No se pudo buscar en la documentación: ${err instanceof Error ? err.message : String(err)}. ` +
        `¿Ejecutaste /ingest?`,
    });
  }
}

// --- create_issue ---

async function nextIssueNumber(issuesDir: string): Promise<number> {
  await mkdir(issuesDir, { recursive: true });
  const files = await readdir(issuesDir);

  const numbers = files
    .map((f) => f.match(/^ISSUE-(\d+)\.md$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => parseInt(m[1]!, 10));

  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}

async function executeCreateIssue(input: Record<string, unknown>): Promise<string> {
  const title = input["title"] as string;
  const description = input["description"] as string;
  const labels = (input["labels"] as string[] | undefined) ?? [];
  const priority = (input["priority"] as string | undefined) ?? "medium";

  const issuesDir = "./issues";
  const number = await nextIssueNumber(issuesDir);

  const content = `# Issue #${number}: ${title}

## Metadata

- **Fecha:** ${new Date().toISOString().split("T")[0]}
- **Prioridad:** ${priority}
- **Etiquetas:** ${labels.length > 0 ? labels.join(", ") : "sin etiquetas"}
- **Estado:** abierto

## Descripción

${description}

---

*Issue creado automáticamente por DevAssistant*
`;

  const filePath = join(issuesDir, `ISSUE-${number}.md`);
  await writeFile(filePath, content, "utf-8");

  const issue: Issue = {
    id: `ISSUE-${number}`,
    title,
    body: description,
    labels,
    createdAt: new Date().toISOString(),
  };

  return JSON.stringify({
    success: true,
    issue,
    saved_to: filePath,
    message: `Issue #${number} creado: "${title}"`,
  });
}

// --- Dispatcher ---

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  try {
    switch (name) {
      case "list_files":
        return await executeListFiles(input);
      case "read_file":
        return await executeReadFile(input);
      case "search_code":
        return await executeSearchCode(input);
      case "search_docs":
        return await executeSearchDocs(input);
      case "create_issue":
        return await executeCreateIssue(input);
      default:
        return JSON.stringify({ error: `Tool desconocida: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({
      error: `Error ejecutando "${name}": ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
