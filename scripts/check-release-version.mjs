import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaces = ["backend", "frontend", "electron", "shared"];

const readVersion = (relativePath) => {
  const manifest = JSON.parse(readFileSync(path.join(root, relativePath, "package.json"), "utf8"));
  return manifest.version;
};

const rootVersion = readVersion(".");
const versions = new Map([[".", rootVersion]]);
for (const workspace of workspaces) {
  versions.set(workspace, readVersion(workspace));
}

const problems = [];

for (const [name, version] of versions) {
  if (version !== rootVersion) {
    problems.push(`${name}/package.json is at ${version}, root package.json is at ${rootVersion}`);
  }
}

const ref = process.env.GITHUB_REF ?? "";
if (ref.startsWith("refs/tags/")) {
  const tag = ref.slice("refs/tags/".length);
  const tagVersion = tag.replace(/^v/, "");
  if (tagVersion !== rootVersion) {
    problems.push(
      `tag ${tag} does not match package.json version ${rootVersion} ` +
        `(bump every package.json, commit, then tag the new commit)`
    );
  }
}

if (problems.length > 0) {
  console.error("Release version check failed:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `Release version check passed: ${rootVersion} ` +
    `(${versions.size} manifests in sync${ref.startsWith("refs/tags/") ? `, tag matches ${ref.slice("refs/tags/".length)}` : ""})`
);
