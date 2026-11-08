import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from "node:fs";
execSync("node gen-prompts.mjs", { stdio: "inherit" });
rmSync("dist", { recursive: true, force: true }); mkdirSync("dist/api", { recursive: true });
const deps = { pg: "^8.16.3", hono: "^4.6.0", "@hono/node-server": "^1.13.0", stripe: "^17.0.0", pdfkit: "^0.15.0", sharp: "^0.34.0", "@vercel/functions": "^3.11.0", "@usenaive-sdk/managed-agents": "^0.12.3" };
await build({ entryPoints: ["src/entry.js"], outfile: "dist/api/app.js", bundle: true, platform: "node", target: "node20", format: "esm", external: Object.keys(deps), banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" } });
if (existsSync("public")) cpSync("public", "dist", { recursive: true });
writeFileSync("dist/vercel.json", JSON.stringify({
  functions: { "api/app.js": { maxDuration: 30 } },
  rewrites: [
    { source: "/mcp", destination: "/api/app?__path=/mcp" },
    { source: "/", destination: "/api/app?__path=/" },
    { source: "/api/(.*)", destination: "/api/app?__path=/api/$1" },
    { source: "/((?!css/|js/|vendor/|img/|media/).*)", destination: "/api/app?__path=/$1" },
  ],
}, null, 2));
writeFileSync("dist/package.json", JSON.stringify({ name: "nightlight-app", private: true, type: "module", engines: { node: ">=20" }, dependencies: deps }, null, 2));
console.log("dist ready");
