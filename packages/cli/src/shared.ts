export function parsePositiveInteger(raw: string | number, optionName: string): number {
  const parsed =
    typeof raw === "number"
      ? raw
      : Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${optionName}. Use a positive integer`);
  }

  return parsed;
}

export function parsePriority(raw: string | number, optionName: string): number {
  const parsed = parsePositiveInteger(raw, optionName);
  if (parsed < 1 || parsed > 5) {
    throw new Error(`Invalid ${optionName}. Use an integer from 1 to 5`);
  }

  return parsed;
}
