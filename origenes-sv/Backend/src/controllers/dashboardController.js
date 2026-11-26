import { getDashboard } from "../services/dashboardService.js";
import { requireId } from "../utils/validation.js";

export async function dashboard(req, res) {
  const branchId = requireId(req.query.branchId, res, "sucursal");
  if (!branchId) return;
  res.json(await getDashboard(branchId));
}
