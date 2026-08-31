import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const distRoot = fileURLToPath(new URL("../dist/", import.meta.url));
const tsBuildInfo = fileURLToPath(new URL("../tsconfig.tsbuildinfo", import.meta.url));

await rm(distRoot, { recursive: true, force: true });
await rm(tsBuildInfo, { force: true });
