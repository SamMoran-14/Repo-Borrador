import { supplierSchema } from "../schemas/supplier.schema.js";
import * as supplierService from "../services/supplierService.js";
import { parseOrRespond, requireId } from "../utils/validation.js";

export async function listSuppliers(_req, res) {
  res.json(await supplierService.listSuppliers());
}

export async function createSupplier(req, res) {
  const data = parseOrRespond(supplierSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await supplierService.createSupplier(data));
}

export async function deleteSupplier(req, res) {
  const supplierId = requireId(req.params.id, res, "proveedor");
  if (!supplierId) return;
  await supplierService.deactivateSupplier(supplierId);
  res.json({ deleted: true });
}
