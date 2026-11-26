/* Khởi chạy reconciliation-service: npm start (cổng 8788, dữ liệu ở data/rec.db) */
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Db } from "./db.ts";
import { RecService } from "./service.ts";
import { createApp } from "./http.ts";
import { seedIfEmpty } from "./seed.ts";
import { runJobs } from "./jobs.ts";

const PORT = Number(process.env.PORT ?? 8788);
const HOST = process.env.HOST ?? "0.0.0.0";
const DB_PATH = process.env.DB_PATH ?? fileURLToPath(new URL("../data/rec.db", import.meta.url));
const DEV = process.env.NODE_ENV !== "production";

const svc = new RecService(new Db(DB_PATH));
if (seedIfEmpty(svc)) console.log("Đã tạo dữ liệu mẫu");

const resetDb = () => {
  svc.db.raw.close();
  for (const f of [DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) rmSync(f, { force: true });
  return new Db(DB_PATH);
};

const security = { gatewaySecret: process.env.GATEWAY_SHARED_SECRET, allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean) };
createApp(svc, { dev: DEV, resetDb, security }).server().listen(PORT, HOST, () =>
  console.log(`reconciliation-service chạy tại http://localhost:${PORT}/api/v1/rec (${DEV ? "dev" : "production"})`));

setInterval(() => {
  const r = runJobs(svc);
  if (Object.values(r).some(Boolean)) console.log("jobs", r);
}, 60_000).unref();
