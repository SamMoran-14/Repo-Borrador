import { inventoryItemSchema, inventoryTypeSchema } from "../schemas/inventory.schema.js";
import * as inventoryService from "../services/inventoryService.js";
import { parseOrRespond, requireId } from "../utils/validation.js";

export async function listInventory(req, res) {
  const branchId = requireId(req.query.branchId, res, "sucursal");
  if (!branchId) return;
  res.json(await inventoryService.listInventory(branchId));
}

export async function createInventoryItem(req, res) {
  const data = parseOrRespond(inventoryItemSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await inventoryService.createInventoryItem(data));
}

export async function deleteInventoryItem(req, res) {
  const type = inventoryTypeSchema.safeParse(req.params.type);
  if (!type.success) return res.status(400).json({ error: "El tipo de artículo no es válido." });
  const id = requireId(req.params.id, res, "artículo");
  if (!id) return;
  await inventoryService.deactivateInventoryItem(type.data, id);
  res.json({ deleted: true });
}
