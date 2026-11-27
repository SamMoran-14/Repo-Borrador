import { z } from "zod";
import { idSchema } from "./common.schema.js";

export const inventoryTypes = ["INGREDIENT", "RESALE"];

// Validación para crear artículos de inventario (insumo o producto empacado).
export const inventoryItemSchema = z.object({
  branchId: idSchema,
  type: z.enum(inventoryTypes),
  name: z.string().trim().min(2).max(140),
  unit: z.string().trim().min(1).max(20),
  quantity: z.coerce.number().nonnegative().max(1_000_000),
  minimumStock: z.coerce.number().nonnegative().max(1_000_000).default(0),
  price: z.coerce.number().positive().max(100_000).optional()
}).refine((item) => item.type !== "RESALE" || item.price !== undefined, {
  path: ["price"],
  message: "Indique el precio de venta del producto empacado."
});

export const inventoryTypeSchema = z.enum(inventoryTypes);
