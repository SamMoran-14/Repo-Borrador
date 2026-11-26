import { Router } from "express";
import { createAuthController } from "../controllers/authController.js";
import { health } from "../controllers/healthController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { createLoginLimit } from "../middlewares/rateLimits.js";
import { createAuthRoutes } from "./auth.routes.js";
import branchRoutes from "./branch.routes.js";
import cashRoutes from "./cash.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import employeeRoutes from "./employee.routes.js";
import inventoryRoutes from "./inventory.routes.js";
import payrollRoutes from "./payroll.routes.js";
import productRoutes from "./product.routes.js";
import purchaseRoutes from "./purchase.routes.js";
import saleRoutes from "./sale.routes.js";
import supplierRoutes from "./supplier.routes.js";

// Router de la API (se monta en /api). Todo lo que está después de `authenticate` exige JWT.
export function createApiRouter({ jwtSecret }) {
  const api = Router();
  const authController = createAuthController({ jwtSecret });

  // Rutas públicas
  api.get("/health", health);
  api.post("/auth/login", createLoginLimit(), authController.login);

  // Rutas protegidas
  api.use(authenticate(jwtSecret));
  api.use("/auth", createAuthRoutes(authController));
  api.use("/branches", branchRoutes);
  api.use("/dashboard", dashboardRoutes);
  api.use("/products", productRoutes);
  api.use("/inventory", inventoryRoutes);
  api.use("/suppliers", supplierRoutes);
  api.use("/purchases", purchaseRoutes);
  api.use("/cash", cashRoutes);
  api.use("/sales", saleRoutes);
  api.use("/employees", employeeRoutes);
  api.use("/payroll", payrollRoutes);

  return api;
}
