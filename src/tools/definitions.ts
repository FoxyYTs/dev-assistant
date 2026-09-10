import type { ToolDefinition } from "../types.js";

// === Tools de exploración de código ===

const LIST_FILES_TOOL: ToolDefinition = {
  name: "list_files",
  description:
    "Explora la estructura de directorios del proyecto. Úsala para orientarte " +
    "antes de leer archivos específicos. Ignora node_modules, .git, dist y data.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Ruta relativa al directorio a explorar (default: '.').",
      },
      recursive: {
        type: "boolean",
        description:
          "Si es true, explora subdirectorios recursivamente (default: false).",
      },
    },
    required: [],
  },
};

const READ_FILE_TOOL: ToolDefinition = {
  name: "read_file",
  description:
    "Lee el contenido completo de un archivo. Úsala para inspeccionar código " +
    "fuente, configuración o documentación local del proyecto.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Ruta relativa del archivo a leer, dentro del proyecto.",
      },
    },
    required: ["path"],
  },
};

const SEARCH_CODE_TOOL: ToolDefinition = {
  name: "search_code",
  description:
    "Busca un patrón de texto en los archivos del proyecto (.ts, .js, .json, .md). " +
    "Úsala para encontrar usos de funciones, imports, variables o cualquier patrón específico.",
  input_schema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Texto a buscar en los archivos (búsqueda literal, no regex).",
      },
      path: {
        type: "string",
        description: "Directorio raíz donde buscar (default: 'src').",
      },
    },
    required: ["pattern"],
  },
};

// === Tools sobre documentación y seguimiento ===

const SEARCH_DOCS_TOOL: ToolDefinition = {
  name: "search_docs",
  description:
    "Busca información en la documentación ingestada usando búsqueda semántica. " +
    "Úsala cuando el usuario pregunta sobre cómo usar una API, conceptos del sistema, " +
    "o cualquier información que podría estar en los docs técnicos del proyecto. " +
    "Requiere que los documentos estén cargados con el comando /ingest. " +
    "Retorna los fragmentos más relevantes con su fuente y sección.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "La pregunta o tema a buscar en la documentación.",
      },
      top_k: {
        type: "number",
        description: "Número de fragmentos a recuperar (default: 5, máximo: 10).",
      },
    },
    required: ["query"],
  },
};

const CREATE_ISSUE_TOOL: ToolDefinition = {
  name: "create_issue",
  description:
    "Crea un issue o tarea en el directorio ./issues/ del proyecto. " +
    "Úsala cuando el usuario quiera reportar un bug, registrar una mejora, " +
    "o crear una tarea de seguimiento. " +
    "Los issues se guardan como archivos Markdown con numeración automática.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Título conciso del issue.",
      },
      description: {
        type: "string",
        description: "Descripción detallada del problema o tarea.",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description:
          "Etiquetas opcionales (ej: ['bug', 'enhancement', 'documentation']).",
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Prioridad del issue (default: medium).",
      },
    },
    required: ["title", "description"],
  },
};

/** Registro único con todas las tools disponibles para el agente. */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  LIST_FILES_TOOL,
  READ_FILE_TOOL,
  SEARCH_CODE_TOOL,
  SEARCH_DOCS_TOOL,
  CREATE_ISSUE_TOOL,
];
