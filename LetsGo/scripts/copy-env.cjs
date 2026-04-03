const fs = require("fs");
const path = require("path");

const dest = path.join(process.cwd(), ".env");
const src = path.join(process.cwd(), ".env.example");

if (!fs.existsSync(src)) {
  console.error("Missing .env.example");
  process.exit(1);
}
if (fs.existsSync(dest)) {
  console.log(".env already exists — not overwritten.");
  process.exit(0);
}
fs.copyFileSync(src, dest);
console.log("Created .env from .env.example — add your Supabase keys.");
