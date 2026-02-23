import { parseArgs } from "util";
import { initializeSqlitePragmas } from "./db";

await initializeSqlitePragmas();

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`sitback v${VERSION}

Usage:
  sb help
  sb --help
  sb -h

Commands:
  help      Show this help output

Global options:
  -h, --help     Show help

Examples:
  sb help
  sb --help`);
}

const args = Bun.argv.slice(2);

const parsed = parseArgs({
  args,
  options: {
    help: { type: "boolean", short: "h" }
  },
  strict: true,
  allowPositionals: true
});

const { values, positionals } = parsed;
const command = positionals[0];

if (values.help || !command) {
  printHelp();
  process.exit(0);
}

if (command === "help") {
  printHelp();
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
printHelp();
process.exit(1);
