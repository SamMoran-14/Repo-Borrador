import { closeCashSchema, openCashSchema } from "../schemas/cash.schema.js";
import * as cashService from "../services/cashService.js";
import { parseOrRespond, requireId } from "../utils/validation.js";

export async function cashStatus(req, res) {
  const branchId = requireId(req.query.branchId, res, "sucursal");
  if (!branchId) return;
  res.json(await cashService.getCashStatus(branchId));
}

export async function openCash(req, res) {
  const data = parseOrRespond(openCashSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await cashService.openCash(data, Number(req.user.sub)));
}

export async function closeCash(req, res) {
  const data = parseOrRespond(closeCashSchema, req.body, res);
  if (!data) return;
  res.json(await cashService.closeCash(data, Number(req.user.sub)));
}
