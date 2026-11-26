import { saleSchema } from "../schemas/sale.schema.js";
import { createSale as registerSale } from "../services/saleService.js";
import { parseOrRespond } from "../utils/validation.js";

export async function createSale(req, res) {
  const data = parseOrRespond(saleSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await registerSale(data, Number(req.user.sub)));
}
