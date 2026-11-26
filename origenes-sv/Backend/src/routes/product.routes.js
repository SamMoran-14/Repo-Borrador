import { Router } from "express";
import {
  createProduct,
  getRecipe,
  listProducts,
  replaceRecipe
} from "../controllers/productController.js";
import { requireManager } from "../middlewares/requireManager.js";

const router = Router();
router.get("/", listProducts);
router.post("/", requireManager, createProduct);
router.get("/:id/recipe", getRecipe);
router.put("/:id/recipe", requireManager, replaceRecipe);

export default router;
