// Cross-platform guard: drop stray lockfiles from other package managers,
// and refuse to run if install was invoked via npm/yarn instead of pnpm.
const fs = require("fs");

for (const file of ["package-lock.json", "yarn.lock"]) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

const userAgent = process.env.npm_config_user_agent || "";
if (!userAgent.startsWith("pnpm")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
