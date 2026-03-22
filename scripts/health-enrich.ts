#!/usr/bin/env bun
/**
 * Health enrichment script.
 *
 * Called by the health-enrich skill to fetch medical API data.
 * Accepts JSON input on stdin, calls APIs, outputs JSON results.
 *
 * Usage:
 *   echo '{"query":"BUN","type":"lab"}' | bun run scripts/health-enrich.ts lookup
 *   echo '{"annotations":[...],"insights":[...]}' | bun run scripts/health-enrich.ts write-enrichment
 *   echo '{"title":"...","subfolder":"reviews","content":"...","tags":[]}' | bun run scripts/health-enrich.ts write-note
 */

import { getMedicalContext } from "../src/lib/medical-apis/facade";

const command = process.argv[2];

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function lookup() {
  const input = JSON.parse(await readStdin()) as {
    query: string;
    type: "lab" | "medication" | "problem" | "allergy" | "vital";
  };

  const context = await getMedicalContext(input.query, input.type);
  console.log(JSON.stringify(context, null, 2));
}

async function writeEnrichment() {
  const input = JSON.parse(await readStdin()) as {
    annotations: Array<{
      recordId: string;
      recordType: string;
      tags: string[];
      severity: string;
      title: string;
      explanation: string;
      sources: string[];
    }>;
    insights: Array<{
      tags: string[];
      title: string;
      summary: string;
      detail: string;
      trendData?: Array<{ date: string; value: number; label: string }>;
      dateRange?: { start: string; end: string };
    }>;
  };

  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    annotations: input.annotations,
    insights: input.insights,
  };

  const dir = `${process.env.HOME || process.env.USERPROFILE}/.health-dashboard/enrichments`;
  const { mkdirSync, writeFileSync } = await import("fs");
  mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filePath = `${dir}/${timestamp}.enrichment.json`;
  writeFileSync(filePath, JSON.stringify(output, null, 2));

  console.log(JSON.stringify({ filePath, ...output }));
}

async function writeObsidianNote() {
  const input = JSON.parse(await readStdin()) as {
    title: string;
    subfolder: string;
    content: string;
    tags: string[];
  };

  const vaultPath = "E:/Projects/ai-asst";
  const dir = `${vaultPath}/health/${input.subfolder}`;

  const { mkdirSync, writeFileSync, existsSync } = await import("fs");
  mkdirSync(dir, { recursive: true });

  const date = new Date().toISOString().split("T")[0];
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  let filePath = `${dir}/${date}-${slug}.md`;
  let counter = 2;
  while (existsSync(filePath)) {
    filePath = `${dir}/${date}-${slug}-${counter}.md`;
    counter++;
  }

  const frontmatter = [
    "---",
    `title: "${input.title}"`,
    `date: ${date}`,
    "type: insight",
    "domain: health",
    `tags: [${input.tags.join(", ")}]`,
    'notebook: "Health Journal"',
    'source_id: ""',
    "---",
    "",
  ].join("\n");

  writeFileSync(filePath, frontmatter + input.content);
  console.log(JSON.stringify({ filePath }));
}

switch (command) {
  case "lookup":
    await lookup();
    break;
  case "write-enrichment":
    await writeEnrichment();
    break;
  case "write-note":
    await writeObsidianNote();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("Usage: bun run scripts/health-enrich.ts <lookup|write-enrichment|write-note>");
    process.exit(1);
}
