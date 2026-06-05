import { hashPassword } from "../apps/api/src/common/scrypt-password";

// Usage: pnpm auth:hash <password>
// Prints a scrypt passwordHash to paste into an AUTH_ACCOUNTS entry.
const password = process.argv[2];

if (!password) {
  console.error("Usage: pnpm auth:hash <password>");
  process.exit(1);
}

console.log(hashPassword(password));
