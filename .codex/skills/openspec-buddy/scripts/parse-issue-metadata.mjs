#!/usr/bin/env node
import fs from "node:fs";

const source = process.argv[2] || "-";
const body = source === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(source, "utf8");
const listKeys = new Set(["depends_on", "blocked_by", "blocking"]);

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed === "[]") return [];
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontMatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error("Missing YAML front matter at the start of the issue body.");
  }

  const lines = match[1].split(/\r?\n/);
  const data = {};
  let currentListKey = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem && currentListKey) {
      data[currentListKey].push(parseScalar(listItem[1]));
      continue;
    }

    const pair = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!pair) {
      throw new Error(`Unsupported YAML line: ${line}`);
    }

    const key = pair[1];
    const value = pair[2] ?? "";
    if (value.trim() === "") {
      if (listKeys.has(key)) {
        data[key] = [];
        currentListKey = key;
        continue;
      }
      data[key] = "";
      currentListKey = null;
      continue;
    }

    data[key] = parseScalar(value);
    currentListKey = Array.isArray(data[key]) ? key : null;
  }

  return data;
}

function validate(data) {
  const errors = [];
  const required = [
    "change_id",
    "claim_branch",
    "series",
    "coupling_group",
    "execution_mode",
    "base_branch",
    "depends_on",
    "openspec_path",
    "risk",
    "area",
  ];

  for (const field of required) {
    if (!(field in data) || data[field] === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (typeof data.change_id === "string" && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.change_id)) {
    errors.push("change_id must be kebab-case.");
  }

  if (data.claim_branch !== data.change_id) {
    errors.push("claim_branch must equal change_id.");
  }

  const expectedBaseBranch = "integration";
  if (data.base_branch !== expectedBaseBranch) {
    errors.push(`base_branch must be ${expectedBaseBranch}.`);
  }

  const expectedPath = `openspec/changes/${data.change_id}`;
  if (data.openspec_path && data.openspec_path !== expectedPath) {
    errors.push(`openspec_path should be ${expectedPath}.`);
  }

  const modes = new Set(["isolated", "fixed-branch", "stacked", "docs-only"]);
  if (data.execution_mode && !modes.has(data.execution_mode)) {
    errors.push("execution_mode must be isolated, fixed-branch, stacked, or docs-only.");
  }

  const risks = new Set(["low", "medium", "high"]);
  if (data.risk && !risks.has(data.risk)) {
    errors.push("risk must be low, medium, or high.");
  }

  if (!Array.isArray(data.depends_on)) {
    data.depends_on = data.depends_on === "" ? [] : [data.depends_on];
  }

  if (data.execution_mode === "fixed-branch" && data.required_branch !== data.claim_branch) {
    errors.push("fixed-branch changes require required_branch to equal claim_branch.");
  }

  if (data.execution_mode === "stacked" && data.depends_on.length === 0) {
    errors.push("stacked changes require at least one dependency.");
  }

  if (errors.length > 0) {
    const err = new Error(errors.join("\n"));
    err.errors = errors;
    throw err;
  }
}

try {
  const data = parseFrontMatter(body);
  validate(data);
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
