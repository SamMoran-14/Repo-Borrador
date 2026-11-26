import { z } from "zod";
import { idSchema } from "./common.schema.js";

const recipeItemsSchema = z.array(z.object({
  ingredientId: idSchema,
  quantity: z.coerce.number().positive().max(1_000_000)
})).min(1, "La receta debe tener al menos un ingrediente.");

const hasUniqueIngredients = (items) =>
  new Set(items.map((item) => item.ingredientId)).size === items.length;

// Validación para reemplazar la receta de un producto.
export const recipeSchema = z.object({
  items: recipeItemsSchema
}).refine((recipe) => hasUniqueIngredients(recipe.items), {
  path: ["items"],
  message: "No repita el mismo ingrediente en la receta."
});

// Validación para crear un producto elaborado con su receta.
export const newProductSchema = z.object({
  name: z.string().trim().min(2).max(140),
  category: z.string().trim().min(2).max(60),
  price: z.coerce.number().positive().max(100_000),
  items: recipeItemsSchema
}).refine((product) => hasUniqueIngredients(product.items), {
  path: ["items"],
  message: "No repita el mismo ingrediente en la receta."
});
