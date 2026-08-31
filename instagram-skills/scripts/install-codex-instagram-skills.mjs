import { constants } from "node:fs";
import { access, cp, mkdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const codexSkillsRoot = resolve(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills");
const distributionRoot = join(repoRoot, "dist-skills");

const skills = [
  "instagram-warmup-orchestrator",
  "instagram-connector",
  "instagram-aiograpi-rest",
  "instagram-profile-setup",
  "instagram-video-interaction"
];

await run("pnpm", ["build"]);

for (const skill of skills) {
  const source = join(distributionRoot, skill);
  const target = join(codexSkillsRoot, skill);

  await mkdir(target, { recursive: true });
  await copyRequiredFile(source, target, "SKILL.md");
  await copyRequiredFile(source, target, "package.json");
  await replaceDirectory(join(source, "dist"), join(target, "dist"));

  await copyOptionalDirectory(join(source, "scripts"), join(target, "scripts"));
  await copyOptionalDirectory(join(source, "references"), join(target, "references"));
  await copyOptionalDirectory(join(source, "runtime"), join(target, "runtime"));
}

console.log(`installed ${skills.length} Codex skills into ${codexSkillsRoot}`);

async function run(command, args) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      shell: process.platform === "win32",
      stdio: "inherit",
      windowsHide: true
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function copyRequiredFile(sourceRoot, targetRoot, relativePath) {
  const source = join(sourceRoot, relativePath);
  await access(source, constants.R_OK);
  await cp(source, join(targetRoot, relativePath), { force: true });
}

async function copyOptionalDirectory(source, target) {
  if (!(await exists(source))) return;
  await replaceDirectory(source, target);
}

async function replaceDirectory(source, target, options = { recursive: true, force: true }) {
  await assertWithin(codexSkillsRoot, target);
  await access(source, constants.R_OK);
  await rm(target, { recursive: true, force: true });
  await cp(source, target, options);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function assertWithin(base, target) {
  const normalizedBase = `${resolve(base)}\\`.toLowerCase();
  const normalizedTarget = `${resolve(target)}\\`.toLowerCase();
  if (!normalizedTarget.startsWith(normalizedBase)) {
    throw new Error(`Refusing to remove outside Codex skills root: ${target}`);
  }
}
