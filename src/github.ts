import { appendFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { EOL } from "node:os";
import { randomBytes } from "node:crypto";

type InputOptions = {
  required?: boolean;
};

export function getInput(name: string, options: InputOptions = {}): string {
  const key = name.replace(/ /g, "_").toUpperCase();
  const value = process.env[`INPUT_${key}`] ?? process.env[`INPUT_${key.replace(/-/g, "_")}`] ?? "";
  const trimmed = value.trim();

  if (options.required && !trimmed) {
    throw new Error(`Input required and not supplied: ${name}`);
  }

  return trimmed;
}

export function setSecret(value: string): void {
  issueCommand("add-mask", value);
}

export function setOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (outputPath) {
    const delimiter = delimiterFor(value);
    appendFileSync(outputPath, `${name}<<${delimiter}${EOL}${value}${EOL}${delimiter}${EOL}`);
    return;
  }

  issueCommand("set-output", value, { name });
}

export function info(message: string): void {
  console.log(message);
}

export function warning(message: string): void {
  issueCommand("warning", message);
}

export function setFailed(message: string): void {
  process.exitCode = 1;
  issueCommand("error", message);
}

export async function appendStepSummary(markdown: string): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  await appendFile(summaryPath, markdown.endsWith(EOL) ? markdown : `${markdown}${EOL}`, "utf8");
}

function delimiterFor(value: string): string {
  let delimiter = "";
  do {
    delimiter = `drebin451_${randomBytes(16).toString("hex")}`;
  } while (value.includes(delimiter));
  return delimiter;
}

function issueCommand(command: string, message: string, properties: Record<string, string> = {}): void {
  const serializedProperties = Object.entries(properties)
    .map(([key, value]) => `${key}=${escapeProperty(value)}`)
    .join(",");
  const propertySuffix = serializedProperties ? ` ${serializedProperties}` : "";

  console.log(`::${command}${propertySuffix}::${escapeData(message)}`);
}

function escapeData(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function escapeProperty(value: string): string {
  return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}
