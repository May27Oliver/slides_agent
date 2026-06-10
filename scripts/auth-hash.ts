import { createInterface } from "node:readline/promises";
import { hashPassword } from "../apps/api/src/common/scrypt-password";

// Usage: pnpm auth:hash            (prompts for the password)
//        echo "secret" | pnpm auth:hash   (reads one line from a pipe)
// Reads the password from stdin instead of argv so it is never exposed in the
// process list (ps) or shell history. Prints a scrypt passwordHash to paste into
// an AUTH_ACCOUNTS entry.
async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const password = (await rl.question(process.stdin.isTTY ? "Password: " : "")).trim();
  rl.close();

  if (!password) {
    process.stderr.write("No password provided. Usage: pnpm auth:hash (then type the password)\n");
    process.exit(1);
  }

  process.stdout.write(`${await hashPassword(password)}\n`);
}

main().catch((error) => {
  process.stderr.write(`auth:hash failed: ${String(error)}\n`);
  process.exit(1);
});
