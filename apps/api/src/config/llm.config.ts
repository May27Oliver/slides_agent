import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

export type LlmProvider = "openai";

export interface LlmRuntimeConfig {
  provider: LlmProvider;
  defaultModel?: string;
  semanticSegmentationModel?: string;
  designPlanningModel?: string;
  openAiApiKey?: string;
  hasOpenAiApiKey: boolean;
  maxRepairAttempts: number;
}

interface LlmRuntimeConfigOptions {
  readDotEnv?: boolean;
  cwd?: string;
}

type EnvMap = Record<string, string | undefined>;

export function loadLlmRuntimeConfig(
  env: EnvMap = process.env,
  options: LlmRuntimeConfigOptions = {}
): LlmRuntimeConfig {
  const mergedEnv = options.readDotEnv === false ? env : { ...readDotEnv(options.cwd), ...env };
  const provider = optionalValue(mergedEnv.LLM_PROVIDER) ?? "openai";

  if (provider !== "openai") {
    throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
  }

  const openAiApiKey = optionalValue(mergedEnv.OPENAI_API_KEY);
  const defaultModel = optionalValue(mergedEnv.LLM_MODEL);
  const semanticSegmentationModel = optionalValue(mergedEnv.SEMANTIC_SEGMENTATION_MODEL);
  const designPlanningRuntimeModel = optionalValue(mergedEnv.DESIGN_PLANNING_MODEL);

  return {
    provider,
    ...(defaultModel ? { defaultModel } : {}),
    ...(semanticSegmentationModel ? { semanticSegmentationModel } : {}),
    ...(designPlanningRuntimeModel ? { designPlanningModel: designPlanningRuntimeModel } : {}),
    ...(openAiApiKey ? { openAiApiKey } : {}),
    hasOpenAiApiKey: Boolean(openAiApiKey),
    maxRepairAttempts: parseRepairAttempts(mergedEnv.LLM_MAX_REPAIR_ATTEMPTS)
  };
}

export function designPlanningModel(config: LlmRuntimeConfig): string | undefined {
  return config.designPlanningModel ?? config.defaultModel;
}

export function semanticSegmentationModel(config: LlmRuntimeConfig): string | undefined {
  return config.semanticSegmentationModel ?? config.defaultModel;
}

function optionalValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseRepairAttempts(value: string | undefined): number {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid LLM_MAX_REPAIR_ATTEMPTS: ${value}`);
  }

  return parsed;
}

function readDotEnv(cwd = process.cwd()): EnvMap {
  const envPath = findDotEnv(cwd);
  if (!envPath) {
    return {};
  }

  return parseDotEnv(readFileSync(envPath, "utf8"));
}

function findDotEnv(cwd: string): string | undefined {
  let current = cwd;

  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = join(current, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }

  return undefined;
}

function parseDotEnv(contents: string): EnvMap {
  const env: EnvMap = {};

  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = stripOptionalQuotes(value);
  }

  return env;
}

function stripOptionalQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
