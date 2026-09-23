import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const distRoot = resolve(process.argv[2] ?? "dist");
const appsRoot = join(distRoot, "apps");

if (!existsSync(appsRoot)) {
  throw new Error(`Pages app directory is missing: ${appsRoot}`);
}

const appDirectories = readdirSync(appsRoot)
  .map((entry) => join(appsRoot, entry))
  .filter((entry) => statSync(entry).isDirectory())
  .sort();

if (appDirectories.length === 0) {
  throw new Error("Pages artifact contains no staged Expo apps.");
}

for (const appDirectory of appDirectories) {
  const slug = basename(appDirectory);
  const indexPath = join(appDirectory, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(`Staged Expo app is missing index.html: ${slug}`);
  }

  const html = readFileSync(indexPath, "utf8");
  const expectedBaseUrl = `/example-apps/apps/${slug}`;
  const resourceUrls = [...html.matchAll(/(?:src|href)=["'](\/[^"'#?]*)/g)].map(
    (match) => match[1],
  );

  if (resourceUrls.length === 0) {
    throw new Error(`Staged Expo app has no absolute bundled resource URL to verify: ${slug}`);
  }

  const invalid = resourceUrls.filter(
    (url) => url !== expectedBaseUrl && !url.startsWith(`${expectedBaseUrl}/`),
  );

  if (invalid.length > 0) {
    throw new Error(
      `Staged Expo app ${slug} escaped its Pages base URL: ${invalid.join(", ")}`,
    );
  }
}

console.log(`Verified Pages base URLs for ${appDirectories.length} Expo apps.`);
