import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

interface CodeSample {
  name: string;
  language: string;
  code: string;
}

const SAMPLES: CodeSample[] = [
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
    messages: [
      {
        role: "user",
        content: `Eres un experto en code review. Analiza el siguiente código ${sample.language} e identifica:

1. **Bugs o errores lógicos**
2. **Vulnerabilidades de seguridad**
3. **Problemas de rendimiento**
4. **Violaciones de buenas prácticas**
5. **Versión mejorada del código**

Código a revisar:
\`\`\`${sample.language}
${sample.code}
\`\`\`

Sé específico y proporciona código corregido.`,
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
