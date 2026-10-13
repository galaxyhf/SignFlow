import "reflect-metadata";
import "../../config/env";
import { createApp } from "../../main";
import { JobsService } from "./jobs.service";
async function main() {
  const app = await createApp();
  try {
    console.log(await app.get(JobsService).runOne());
  } finally {
    await app.close();
  }
}
main().catch(() => {
  console.error("Falha na execução de jobs");
  process.exit(1);
});
