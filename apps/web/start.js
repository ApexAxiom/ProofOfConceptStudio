const { spawn } = require("node:child_process");

const port = process.env.PORT || "3000";
const child = spawn(process.execPath, ["../../node_modules/next/dist/bin/next", "start", "-p", port, "--hostname", "0.0.0.0"], {
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
