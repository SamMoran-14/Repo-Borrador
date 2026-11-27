import { Router } from "express";
import { createEmployee, listEmployees } from "../controllers/employeeController.js";

const router = Router();
router.get("/", listEmployees);
router.post("/", createEmployee);

export default router;
