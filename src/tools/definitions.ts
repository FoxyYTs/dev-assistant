import type { ToolDefinition } from "../types.js";

// === Tools de exploración de código (gist TOOL DEFINITION del curso) ===

const LIST_FILES_TOOL: ToolDefinition = {
  name: "list_files",
  description:
    "Lista los archivos de un directorio del proyecto. " +
    "Útil para explorar la estructura del codebase antes de leer archivos específicos. " +
    "Puede filtrar por extensión de archivo.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Ruta del directorio a listar, relativa al proyecto (ej: './src', './src/llm'). " +
          "Usa '.' para el directorio raíz del proyecto.",
      },
      extension: {
        type: "string",
        description:
          "Extensión de archivo para filtrar resultados (ej: '.ts', '.md', '.json'). " +
          "Si se omite, se listan todos los archivos.",
      },
    },
    required: ["path"],
  },
};

const READ_FILE_TOOL: ToolDefinition = {
  name: "read_file",
  description:
    "Lee el contenido completo de un archivo del proyecto. " +
    "Útil para inspeccionar código fuente, configuración, o documentación. " +
    "Limitado a archivos de máximo 50,000 caracteres.",
  input_schema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description:
          "Ruta del archivo a leer, relativa al proyecto (ej: './src/config.ts', './README.md'). " +
          "Debe ser la ruta completa incluyendo nombre y extensión.",
      },
    },
    required: ["file_path"],
  },
};

const SEARCH_CODE_TOOL: ToolDefinition = {
  name: "search_code",
  description:
    "Busca un patrón de texto en los archivos del proyecto y retorna las líneas que coinciden " +
    "con contexto de 2 líneas arriba y abajo. " +
    "Útil para encontrar usos de funciones, variables, o patrones específicos en el codebase.",
  input_schema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description:
          "Texto a buscar (búsqueda exacta por substring, sensible a mayúsculas). " +
          "Ejemplo: 'askClaude', 'export default', 'import Anthropic'",
      },
      path: {
        type: "string",
        description:
          "Directorio donde buscar, relativo al proyecto (ej: './src', './src/llm'). " +
          "Si se omite, busca en todo el proyecto.",
      },
      file_extension: {
        type: "string",
        description:
          "Filtrar búsqueda a archivos con esta extensión (ej: '.ts', '.md'). " +
          "Si se omite, busca en todos los tipos de archivo.",
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
    "Crea un issue o tarea en la carpeta issues/ del proyecto. " +
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
