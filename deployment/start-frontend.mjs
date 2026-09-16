import path from "node:path";
import { startProdServer } from "vinext/server/prod-server";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "127.0.0.1";

await startProdServer({
  port,
  host,
  outDir: path.resolve(process.cwd(), "dist"),
});
