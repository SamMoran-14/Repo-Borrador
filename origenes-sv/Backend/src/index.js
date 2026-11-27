import { config } from "./config/env.js";
import { initializeDatabase, pool } from "./config/db.js";
import { createAdminUser } from "./services/authService.js";
import { createApp } from "./app.js";

try {
  await initializeDatabase();
  await createAdminUser();
  const app = createApp({ jwtSecret: config.JWT_SECRET, appOrigin: config.APP_ORIGIN });
  const server = app.listen(config.PORT, () => {
    console.log(`Orígenes SV API escuchando en http://localhost:${config.PORT}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    });
  }
} catch (error) {
  console.error("No se pudo iniciar Orígenes SV:", error);
  await pool.end();
  process.exit(1);
}