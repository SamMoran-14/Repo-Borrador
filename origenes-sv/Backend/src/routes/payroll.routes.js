import { Router } from "express";
import { createPayroll, listPayroll } from "../controllers/payrollController.js";

const router = Router();
router.get("/", listPayroll);
router.post("/", createPayroll);

export default router;
