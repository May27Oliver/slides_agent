import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

export function rootFixturePath(name: string): string {
  return fileURLToPath(new URL(`../../../../tests/fixtures/${name}`, import.meta.url));
}

export function readRootFixture(name: string): string {
  return readFileSync(rootFixturePath(name), "utf8");
}

export function readJsonFixture<TFixture>(name: string): TFixture {
  return JSON.parse(readRootFixture(name)) as TFixture;
}
