import { ValidationError } from "@cliffy/command";
import type { ArgumentValue } from "@cliffy/command";

export function dateYmdType({ label, name, value }: ArgumentValue): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new ValidationError(`${label} "${name}" must use YYYY-MM-DD, but got "${value}".`);
  }

  return normalized;
}

export function tagPathType({ label, name, value }: ArgumentValue): string {
  const segments = value.split("/").map((segment) => segment.trim());

  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    throw new ValidationError(
      `${label} "${name}" must be a slash-separated path with non-empty segments, but got "${value}".`
    );
  }

  const normalizedSegments = segments.map((segment) => segment.toLowerCase());
  if (normalizedSegments.some((segment) => !/^[a-z0-9]+$/.test(segment))) {
    throw new ValidationError(`${label} "${name}" must contain only alphanumeric segments, but got "${value}".`);
  }

  return normalizedSegments.join("/");
}

export function dateTimeSecondType({ label, name, value }: ArgumentValue): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    throw new ValidationError(
      `${label} "${name}" must use YYYY-MM-DD HH:MM:SS, but got "${value}".`
    );
  }

  return normalized;
}
