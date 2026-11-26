import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { apiNotFound, errorHandler } from "./middlewares/errorHandler.js";
import { createApiRouter } from "./routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ jwtSecret, appOrigin }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    origin: appOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));
  app.use(express.json({ limit: "100kb" }));

  app.use("/api", createApiRouter({ jwtSecret }));
  app.use("/api", apiNotFound);

  // En producción el servidor también entrega el cliente compilado (npm run build -> client/dist/).
  const webRoot = path.resolve(__dirname, "../../Frontend/dist");
  app.use(express.static(webRoot, { index: false }));
  app.get("/{*path}", (_req, res, next) => {
    res.sendFile(path.join(webRoot, "index.html"), (error) => {
      if (error) next();
    });
  });

  app.use(errorHandler);
  return app;
}
