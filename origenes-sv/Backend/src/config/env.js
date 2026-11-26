import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

// El archivo .env vive en la raíz del monorepo (junto a docker-compose.yml),
// sin importar desde qué carpeta se arranque el servidor.
dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const parsed = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32)
}).safeParse(process.env);

if (!parsed.success) {
  console.error("Configuración inválida:", parsed.error.issues);
  process.exit(1);
}

export const config = parsed.data;
