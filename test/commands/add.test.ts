import { afterEach, describe, expect, test } from "bun:test";
import { createTempConfigDir, removeTempConfigDir, runCli } from "./helpers";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      removeTempConfigDir(dir);
    }
  }
});

describe("cli add", () => {
  test("fails when --description is missing", () => {
    const configDir = createTempConfigDir("sitback-cli-add-");
    tempDirs.push(configDir);

    const result = runCli(["todo", "add", "--status", "todo"], configDir);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Missing required option "--description"');
  });

  test("creates todo with metadata fields", () => {
    const configDir = createTempConfigDir("sitback-cli-add-");
    tempDirs.push(configDir);

    const result = runCli(
      [
        "todo",
        "add",
        "--description",
        "compile report",
        "--status",
        "todo",
        "--priority",
        "2",
        "--due-date",
        "2031-04-15",
        "--input-artifacts",
        "logs/build.log",
        "--output-artifacts",
        "reports/build.md",
        "--work-notes",
        "Investigate flaky step"
      ],
      configDir
    );

    expect(result.exitCode).toBe(0);
    const todo = Bun.JSON5.parse(result.stdout) as Record<string, unknown>;

    expect(todo.description).toBe("compile report");
    expect(todo.status).toBe("todo");
    expect(todo.priority).toBe(2);
    expect(todo.dueDate).toBe("2031-04-15");
    expect(todo.inputArtifacts).toBe("logs/build.log");
    expect(todo.outputArtifacts).toBe("reports/build.md");
    expect(todo.workNotes).toBe("Investigate flaky step");
  });

  test("rejects invalid --due-date via custom type", () => {
    const configDir = createTempConfigDir("sitback-cli-add-");
    tempDirs.push(configDir);

    const result = runCli(["todo", "add", "--description", "x", "--due-date", "2031/04/15"], configDir);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Option "--due-date" must use YYYY-MM-DD, but got "2031/04/15"');
  });

  test("rejects invalid --tag path via custom type", () => {
    const configDir = createTempConfigDir("sitback-cli-add-");
    tempDirs.push(configDir);

    const result = runCli(["todo", "add", "--description", "x", "--tag", "work//api"], configDir);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Option "--tag" must be a slash-separated path with non-empty segments');
  });
});
