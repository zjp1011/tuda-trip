import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type {
  AgentEditScope,
  AgentToolAction,
  TravelPlanToolReport,
} from "./travelPlanTools";
import type { DestinationWeather } from "./weatherTool";

export type AgentTrace = {
  id: string;
  userId: string;
  instruction: string;
  status: "success" | "failed";
  reply?: string;
  error?: string;
  createdAt: string;
  editScope: AgentEditScope;
  actions: AgentToolAction[];
  toolReport: TravelPlanToolReport;
  weatherSummary?: string;
  memoryPreferences: string[];
  guardrailIssues: string[];
};

type AgentTraceStore = Record<string, AgentTrace[]>;

const dataDirectory = path.join(process.cwd(), ".data");
const storePath = path.join(dataDirectory, "agent-traces.json");

async function readStore(): Promise<AgentTraceStore> {
  try {
    const content = await readFile(storePath, "utf8");
    return JSON.parse(content) as AgentTraceStore;
  } catch {
    return {};
  }
}

async function writeStore(store: AgentTraceStore) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function saveAgentTrace(trace: AgentTrace) {
  const store = await readStore();
  const existingTraces = store[trace.userId] ?? [];
  store[trace.userId] = [trace, ...existingTraces].slice(0, 50);
  await writeStore(store);
  return trace;
}

export async function getAgentTraces(userId: string) {
  const store = await readStore();
  return store[userId] ?? [];
}

export function createAgentTrace(input: {
  userId?: string;
  instruction: string;
  status: AgentTrace["status"];
  reply?: string;
  error?: string;
  editScope: AgentEditScope;
  actions: AgentToolAction[];
  toolReport: TravelPlanToolReport;
  weather: DestinationWeather | null;
  memoryPreferences: string[];
  guardrailIssues: string[];
}) {
  return {
    id: crypto.randomUUID(),
    userId: input.userId || "anonymous",
    instruction: input.instruction,
    status: input.status,
    reply: input.reply,
    error: input.error,
    createdAt: new Date().toISOString(),
    editScope: input.editScope,
    actions: input.actions,
    toolReport: input.toolReport,
    weatherSummary: input.weather?.summary,
    memoryPreferences: input.memoryPreferences,
    guardrailIssues: input.guardrailIssues,
  } satisfies AgentTrace;
}
