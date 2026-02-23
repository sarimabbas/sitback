export function parsePositiveInteger(raw: string, optionName: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${optionName}. Use a positive integer`);
  }

  return parsed;
}

export function parseIdsList(raw: string, optionName: string): number[] {
  const parsedIds = raw.split(",").map((entry) => parsePositiveInteger(entry.trim(), optionName));
  if (parsedIds.length === 0) {
    throw new Error(`Invalid ${optionName}. Use a comma-separated list of positive integer IDs`);
  }

  return parsedIds;
}

export function parseDateString(raw: string, optionName: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid ${optionName}. Use YYYY-MM-DD`);
  }

  return raw;
}

export function parsePriority(raw: string, optionName: string): number {
  const parsed = parsePositiveInteger(raw, optionName);
  if (parsed < 1 || parsed > 5) {
    throw new Error(`Invalid ${optionName}. Use an integer from 1 to 5`);
  }

  return parsed;
}

export function parseBooleanString(raw: string, optionName: string): boolean {
  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  throw new Error(`Invalid ${optionName}. Use true or false`);
}
