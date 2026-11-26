import { purchaseSchema } from "../schemas/purchase.schema.js";
import * as purchaseService from "../services/purchaseService.js";
import { parseOrRespond, requireId } from "../utils/validation.js";

export async function listPurchases(req, res) {
  const branchId = requireId(req.query.branchId, res, "sucursal");
  if (!branchId) return;
  res.json(await purchaseService.listPurchases(branchId));
}

export async function createPurchase(req, res) {
  const data = parseOrRespond(purchaseSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await purchaseService.createPurchase(data, Number(req.user.sub)));
}

export async function deletePurchase(req, res) {
  const purchaseId = requireId(req.params.id, res, "factura");
  if (!purchaseId) return;
  await purchaseService.deletePurchase(purchaseId);
  res.json({ deleted: true });
}
