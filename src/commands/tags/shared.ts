export function normalizeTagName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!/^[a-z0-9]+$/.test(normalized)) {
    throw new Error("Invalid --name. Use lowercase alphanumeric text");
  }

  return normalized;
}
