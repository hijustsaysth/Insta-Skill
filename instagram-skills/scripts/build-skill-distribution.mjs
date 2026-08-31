import { constants } from "node:fs";
import { access, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packagesRoot = join(repoRoot, "packages");
const distributionRoot = join(repoRoot, "dist-skills");

const skills = [
  {
    name: "instagram-warmup-orchestrator",
    requireDist: true,
    requireCliBundle: true
  },
  {
    name: "instagram-connector",
    requireDist: true,
    requireCliBundle: true,
    includeScripts: true,
    includeRuntime: true
  },
  {
    name: "instagram-aiograpi-rest",
    requireDist: true,
    requireCliBundle: true,
    includeScripts: true,
    cliOnlyDist: true
  },
  {
    name: "instagram-profile-setup",
    requireDist: true,
    requireCliBundle: true
  },
  {
    name: "instagram-video-interaction",
    requireDist: true,
    requireCliBundle: true
  }
];

await resetDistributionRoot();

for (const skill of skills) {
  await buildSkill(skill);
}

await writeDistributionReadme();

console.log(`built ${skills.length} distributable skills into ${relative(repoRoot, distributionRoot)}`);

async function buildSkill(skill) {
  const sourceRoot = join(packagesRoot, skill.name);
  const targetRoot = join(distributionRoot, skill.name);

  await access(sourceRoot, constants.R_OK);
  await mkdir(targetRoot, { recursive: true });
  await copyRequiredFile(sourceRoot, targetRoot, "SKILL.md");
  await writeSkillPackageJson(sourceRoot, targetRoot, skill);

  if (skill.requireCliBundle) {
    await buildCliBundle(sourceRoot);
  }

  if (skill.requireDist) {
    if (skill.cliOnlyDist) {
      await copyCliBundleOnly(sourceRoot, targetRoot);
    } else {
      await copyRequiredDirectory(join(sourceRoot, "dist"), join(targetRoot, "dist"));
    }
  }

  if (skill.requireCliBundle) {
    await access(join(targetRoot, "dist", "cli.bundle.js"), constants.R_OK);
  }

  if (skill.includeScripts) {
    await copyOptionalDirectory(join(sourceRoot, "scripts"), join(targetRoot, "scripts"));
  }

  await copyOptionalDirectory(join(sourceRoot, "references"), join(targetRoot, "references"));

  if (skill.includeRuntime) {
    await copyRequiredDirectory(join(sourceRoot, "runtime"), join(targetRoot, "runtime"), {
      recursive: true,
      force: true,
      filter: (source) => !isRuntimeCachePath(source)
    });
    await assertConnectorRuntime(targetRoot);
  }
}

async function buildCliBundle(sourceRoot) {
  const entryPoint = join(sourceRoot, "src", "cli.ts");
  const outputFile = join(sourceRoot, "dist", "cli.bundle.js");

  await access(entryPoint, constants.R_OK);
  await mkdir(join(sourceRoot, "dist"), { recursive: true });
  await esbuild({
    entryPoints: [entryPoint],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    logLevel: "silent"
  });
}

async function resetDistributionRoot() {
  await assertWithin(repoRoot, distributionRoot);
  await rm(distributionRoot, { recursive: true, force: true });
  await mkdir(distributionRoot, { recursive: true });
}

async function copyRequiredFile(sourceRoot, targetRoot, relativePath) {
  const source = join(sourceRoot, relativePath);
  await access(source, constants.R_OK);
  await cp(source, join(targetRoot, relativePath), { force: true });
}

async function copyCliBundleOnly(sourceRoot, targetRoot) {
  const sourceDist = join(sourceRoot, "dist");
  const targetDist = join(targetRoot, "dist");
  await mkdir(targetDist, { recursive: true });
  await copyRequiredFile(sourceDist, targetDist, "cli.bundle.js");

  if (await exists(join(sourceDist, "cli.bundle.js.map"))) {
    await cp(join(sourceDist, "cli.bundle.js.map"), join(targetDist, "cli.bundle.js.map"), { force: true });
  }
}

async function copyRequiredDirectory(source, target, options = { recursive: true, force: true }) {
  await access(source, constants.R_OK);
  await cp(source, target, options);
}

async function copyOptionalDirectory(source, target) {
  if (!(await exists(source))) return;
  await copyRequiredDirectory(source, target);
}

async function writeSkillPackageJson(sourceRoot, targetRoot, skill) {
  const sourcePackage = JSON.parse(await readFile(join(sourceRoot, "package.json"), "utf8"));
  const packageJson = {
    name: skill.name,
    version: sourcePackage.version ?? "0.1.0",
    type: "module",
    private: true,
    ...(skill.requireCliBundle
      ? {
          bin: {
            [skill.name]: "./dist/cli.bundle.js"
          }
        }
      : {}),
    ...(skill.cliOnlyDist
      ? {}
      : {
          main: "./dist/index.js"
        })
  };

  await writeFile(join(targetRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
}

async function writeDistributionReadme() {
  const content = `# Instagram skills 分发目录

本目录包含可分发安装的 Instagram skills。

每个子目录都是一个独立 skill，可整体复制到 agent skills 目录中使用。skill 运行所需的运行时依赖会随对应子目录一起分发。

当前包含的 skills：

${skills.map((skill) => `- ${skill.name}`).join("\n")}
`;

  await writeFile(join(distributionRoot, "README.md"), content);
}

async function assertConnectorRuntime(skillTarget) {
  const runtimeRoot = join(skillTarget, "runtime");
  const requiredFiles = [
    "gradlew.bat",
    "settings.gradle.kts",
    "connector-sdk",
    "local-mobile-runtime",
    "instagram-connector"
  ];

  for (const item of requiredFiles) {
    await access(join(runtimeRoot, item), constants.R_OK);
  }

  const blockedPaths = [
    join(runtimeRoot, ".gradle"),
    join(runtimeRoot, "build"),
    join(runtimeRoot, "instagram-connector", "build"),
    join(runtimeRoot, "local-mobile-runtime", "build"),
    join(runtimeRoot, "connector-sdk", "build")
  ];

  for (const item of blockedPaths) {
    if (await exists(item)) {
      throw new Error(`Runtime cache path should not be distributed: ${basename(item)} at ${item}`);
    }
  }
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
    throw new Error(`Refusing to remove outside repository root: ${target}`);
  }
}

function isRuntimeCachePath(source) {
  const parts = resolve(source).split(/[\\/]+/);
  return parts.some((part) => part === ".gradle" || part === "build");
}
