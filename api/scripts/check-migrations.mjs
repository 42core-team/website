// Old API pods keep serving while a new pod's migrations run (see docs/adr/0004),
// so a migration must not break the schema the running release uses.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Migrations up to this timestamp shipped before this check existed.
const LAST_UNCHECKED_MIGRATION = 1792600000000;

const DESTRUCTIVE =
  /\b(DROP\s+(COLUMN|TABLE)|RENAME\s+(COLUMN|TO)|ALTER\s+COLUMN\s+\S+\s+(SET\s+NOT\s+NULL|(SET\s+DATA\s+)?TYPE))\b/i;
const OVERRIDE = /\/\/\s*zero-downtime:\s*\S/;

const directory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../db/migrations",
);

const violations = readdirSync(directory).flatMap((file) => {
  if (Number.parseInt(file, 10) <= LAST_UNCHECKED_MIGRATION) return [];

  const source = readFileSync(join(directory, file), "utf8");
  if (OVERRIDE.test(source)) return [];

  const up = source.slice(0, source.search(/async\s+down\b/));
  return up
    .split("\n")
    .filter((line) => DESTRUCTIVE.test(line))
    .map((line) => `${file}: ${line.trim()}`);
});

if (violations.length > 0) {
  console.error(
    "These migrations can break the release that is still running during a rollout:\n",
  );
  console.error(violations.join("\n"));
  console.error(
    "\nSplit the change across releases (expand/contract), or explain why this one is safe with a `// zero-downtime: <reason>` comment. See docs/adr/0004.",
  );
  process.exit(1);
}
console.log("Migrations are backward compatible.");
