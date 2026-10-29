// Lance le serveur proxy local et Vite dans le même terminal.
//   npm run dev       → jeu sur http://127.0.0.1:5173 (cette machine seulement)
//   npm run dev:lan   → jeu aussi accessible depuis le réseau local (Wi-Fi de confiance uniquement)
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const lan = process.argv.includes("--lan");
const env = { ...process.env, ...(lan ? { MEGAQUIZ_LAN: "1" } : {}) };

const children = [
  spawn(process.execPath, ["--watch", "server/index.ts"], { cwd: root, stdio: "inherit", env }),
  spawn(process.execPath, [viteBin], { cwd: root, stdio: "inherit", env }),
];

if (lan) {
  // Adresses à donner aux autres appareils (sans les interfaces virtuelles de Docker).
  const addresses = Object.entries(networkInterfaces())
    .filter(([name]) => !/^(docker|br-|veth|virbr|lo)/.test(name))
    .flatMap(([, infos]) => infos ?? [])
    .filter((info) => info.family === "IPv4" && !info.internal)
    .map((info) => `http://${info.address}:5173`);
  console.log(`\n[réseau local] jeu accessible sur : ${addresses.join(", ") || "(aucune adresse trouvée)"}`);
  console.log("[réseau local] à n'utiliser que sur un réseau de confiance (Wi-Fi maison).\n");
}

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}

for (const child of children) {
  child.on("exit", (code) => stop(code ?? 0));
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
