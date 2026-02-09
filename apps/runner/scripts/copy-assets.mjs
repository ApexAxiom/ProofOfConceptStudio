import fs from "node:fs";
import path from "node:path";

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const root = process.cwd(); // apps/runner
const assets = [
  {
    src: path.join(root, "src", "agents", "agents.yaml"),
    dest: path.join(root, "dist", "agents", "agents.yaml")
  }
];

for (const asset of assets) {
  if (!fs.existsSync(asset.src)) {
    throw new Error(`Missing build asset source: ${asset.src}`);
  }
  copyFile(asset.src, asset.dest);
  console.log(`Copied ${path.relative(root, asset.src)} -> ${path.relative(root, asset.dest)}`);
}

