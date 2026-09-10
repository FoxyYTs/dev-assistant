import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { CODE_REVIEWER_PROMPT } from "../llm/prompts.js";

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

interface CodeSample {
  name: string;
  language: string;
  code: string;
}

const SAMPLES: CodeSample[] = [
  {
    name: "Fragmento con SQL injection y comparación débil",
    language: "javascript",
    code: `async function getUser(id) {
  const query = "SELECT * FROM users WHERE id = " + id;
  const result = await db.query(query);
  return result[0];
}

function calcularDescuento(precio, tipo) {
  if (tipo == "vip") {
    return precio * 0.8;
  } else if (tipo == "regular") {
    return precio * 0.9;
  } else {
    return precio;
  }
}`,
  },
  {
    name: "Autenticación JWT con secreto débil",
    language: "javascript",
    code: `async function loginUser(email, password) {
  const user = await db.users.findOne({ email, password });
  if (user) {
    const token = jwt.sign({ userId: user.id }, 'secret123');
    return token;
  }
  return null;
}`,
  },
  {
    name: "Paginación con cursor-based (TaskFlow API)",
    language: "typescript",
    code: `async function getAllTasks(): Promise<Task[]> {
  const allTasks: Task[] = [];
  let page = 1;

  while (true) {
    const tasks = await api.get(\`/tasks?page=\${page}&limit=100\`);
    allTasks.push(...tasks.data);
    if (tasks.data.length < 100) break;
    page++;
  }

  return allTasks;
}`,
  },
  {
    name: "Manejo de rate limiting sin retry",
    language: "typescript",
    code: `async function syncTasks(projectId: string) {
  const tasks = [];
  for (let i = 0; i < 200; i++) {
    const task = await fetch(\`/v1/tasks/\${i}\`, {
      headers: { Authorization: \`Bearer \${token}\` }
    });
    tasks.push(await task.json());
  }
  return tasks;
}`,
  },
];

async function reviewCode(sample: CodeSample): Promise<string> {
  const response = await anthropic.messages.create({
    model: config.anthropicModel,
    max_tokens: 2048,
    system: CODE_REVIEWER_PROMPT,
    messages: [
      {
        role: "user",
        content: `Código ${sample.language} a revisar:

\`\`\`${sample.language}
${sample.code}
\`\`\``,
      },
    ],
  });

  return response.content[0]?.type === "text" ? response.content[0].text : "";
}

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║        Code Reviewer con Claude API      ║");
  console.log("╚══════════════════════════════════════════╝\n");

  for (const sample of SAMPLES) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`Analizando: ${sample.name}`);
    console.log(`${"═".repeat(60)}\n`);
    console.log(`Código:\n\`\`\`${sample.language}\n${sample.code}\n\`\`\`\n`);
    console.log("Revisión de Claude:\n");

    const review = await reviewCode(sample);
    console.log(review);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log("✓ Code review completado.");
}

main().catch(console.error);
