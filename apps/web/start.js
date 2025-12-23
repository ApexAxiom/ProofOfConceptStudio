const { spawn } = require("node:child_process");

const port = Number(process.env.PORT || 8080);
const child = spawn(process.execPath, ["../../node_modules/next/dist/bin/next", "start", "-p", String(port), "--hostname", "0.0.0.0"], {
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
