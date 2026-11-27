import { newProductSchema, recipeSchema } from "../schemas/product.schema.js";
import * as productService from "../services/productService.js";
import { parseOrRespond, requireId } from "../utils/validation.js";

export async function listProducts(_req, res) {
  res.json(await productService.listProducts());
}

export async function getRecipe(req, res) {
  const productId = requireId(req.params.id, res, "producto");
  if (!productId) return;
  res.json(await productService.getRecipe(productId));
}

export async function createProduct(req, res) {
  const data = parseOrRespond(newProductSchema, req.body, res);
  if (!data) return;
  res.status(201).json(await productService.createProduct(data));
}

export async function replaceRecipe(req, res) {
  const productId = requireId(req.params.id, res, "producto");
  if (!productId) return;
  const data = parseOrRespond(recipeSchema, req.body, res);
  if (!data) return;
  await productService.replaceRecipe(productId, data);
  res.json({ saved: true });
}
