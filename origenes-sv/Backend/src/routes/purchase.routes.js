import { Router } from "express";
import {
  createPurchase,
  deletePurchase,
  listPurchases
} from "../controllers/purchaseController.js";
import { requireManager } from "../middlewares/requireManager.js";

const router = Router();
router.get("/", listPurchases);
router.post("/", createPurchase);
router.delete("/:id", requireManager, deletePurchase);

export default router;
