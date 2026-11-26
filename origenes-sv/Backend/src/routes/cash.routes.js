import { Router } from "express";
import { cashStatus, closeCash, openCash } from "../controllers/cashController.js";

const router = Router();
router.get("/status", cashStatus);
router.post("/open", openCash);
router.post("/close", closeCash);

export default router;
