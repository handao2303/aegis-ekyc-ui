/* Khởi chạy ekyc-service: npm start (cổng 8787, dữ liệu ở server/data/aegis.db) */
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Db } from "./db.ts";
import { EkycService } from "./service.ts";
import { createApp } from "./http.ts";
import { seedIfEmpty } from "./seed.ts";
import { runJobs } from "./jobs.ts";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0"; // 0.0.0.0 để iPhone cùng Wi-Fi gọi được
const DB_PATH = process.env.DB_PATH ?? fileURLToPath(new URL("../data/aegis.db", import.meta.url));
const DEV = process.env.NODE_ENV !== "production";

const svc = new EkycService(new Db(DB_PATH), process.env.ID_HASH_SALT ?? "aegis-dev-salt");
if (seedIfEmpty(svc)) console.log("Đã tạo dữ liệu mẫu");

const resetDb = () => {
  svc.db.raw.close();
  for (const f of [DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) rmSync(f, { force: true });
  return new Db(DB_PATH);
};

const app = createApp(svc, { dev: DEV, resetDb });
app.server().listen(PORT, HOST, () => console.log(`ekyc-service chạy tại http://localhost:${PORT} (${DEV ? "dev" : "production"})`));

// Job nền mỗi phút (production: Cloud Scheduler gọi từng job theo lịch trong C06/C09/C12)
setInterval(() => {
  const r = runJobs(svc);
  const changed = Object.entries(r).filter(([, n]) => n);
  if (changed.length) console.log("jobs", Object.fromEntries(changed));
}, 60_000).unref();
