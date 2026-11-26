import { Router } from "express";
import { listBranches } from "../controllers/branchController.js";

const router = Router();
router.get("/", listBranches);

export default router;
