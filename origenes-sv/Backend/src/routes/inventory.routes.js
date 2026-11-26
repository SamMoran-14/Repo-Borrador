import { Router } from "express";
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventory
} from "../controllers/inventoryController.js";
import { requireManager } from "../middlewares/requireManager.js";

const router = Router();
router.get("/", listInventory);
router.post("/", requireManager, createInventoryItem);
router.delete("/:type/:id", requireManager, deleteInventoryItem);

export default router;
