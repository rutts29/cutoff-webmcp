import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(projectRoot, "src/webmcp/toolCatalog.json");
const outputPath = resolve(projectRoot, "evals/schema.json");
const catalog = JSON.parse(await readFile(sourcePath, "utf8"));
const tools = Object.entries(catalog).map(
  ([name, { description, inputSchema }]) => ({
    name,
    description,
    inputSchema,
  }),
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ tools }, null, 2)}\n`);
console.log(`Wrote ${tools.length} tool definitions to evals/schema.json.`);
