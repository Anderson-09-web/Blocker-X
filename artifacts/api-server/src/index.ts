import app from "./app";
import { logger } from "./lib/logger";
import { resetStaleProcesses } from "./lib/process-manager";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  try {
    await resetStaleProcesses();
  } catch (err) {
    logger.warn({ err }, "resetStaleProcesses failed — DB may not be migrated yet. Continuing startup.");
  }

  app.listen(port, "0.0.0.0", (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening on 0.0.0.0");
  });
}

main().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
