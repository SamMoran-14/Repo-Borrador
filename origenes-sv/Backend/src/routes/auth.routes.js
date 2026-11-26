import { Router } from "express";
import { createPasswordChangeLimit } from "../middlewares/rateLimits.js";

// Rutas de sesión que requieren estar autenticado (el login es público y vive en routes/index.js).
export function createAuthRoutes(authController) {
  const router = Router();
  router.get("/me", authController.me);
  router.post("/password", createPasswordChangeLimit(), authController.changePassword);
  return router;
}
