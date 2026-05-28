import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceRoot = resolve(__dirname, "..");

// Tao thu muc dist de Docker runtime co file chay production.
mkdirSync(resolve(serviceRoot, "dist"), { recursive: true });

// Du an API hien tai dung JavaScript thuan, nen build chi can copy file source.
copyFileSync(resolve(serviceRoot, "src/index.js"), resolve(serviceRoot, "dist/index.js"));

console.log("Built api-service into dist/index.js");
