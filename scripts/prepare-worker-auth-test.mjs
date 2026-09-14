import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const config = JSON.parse(execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const entries = {
  NEXT_PUBLIC_SUPABASE_URL: config.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.ANON_KEY,
  NEXT_PUBLIC_CATALOGUE_MODE: "api-demo",
};
for (const [key, value] of Object.entries(entries)) {
  if (typeof value !== "string" || !value || /[\r\n]/.test(value)) throw Error("Missing local Supabase configuration");
  if (key.endsWith("KEY")) console.log(`::add-mask::${value}`);
  appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\n`);
}
writeFileSync(".dev.vars", Object.entries(entries).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n"));
