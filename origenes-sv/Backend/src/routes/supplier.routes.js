import { Router } from "express";
import {
  createSupplier,
  deleteSupplier,
  listSuppliers
} from "../controllers/supplierController.js";
import { requireManager } from "../middlewares/requireManager.js";

const router = Router();
router.get("/", listSuppliers);
router.post("/", requireManager, createSupplier);
router.delete("/:id", requireManager, deleteSupplier);

export default router;
