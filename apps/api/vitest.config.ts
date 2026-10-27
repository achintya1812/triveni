import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Loads the Supabase keys for the round-trip test, which is skipped without them.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({});
