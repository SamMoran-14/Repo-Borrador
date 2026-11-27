import { z } from "zod";
import { idSchema } from "./common.schema.js";

export const purchaseSchema = z.object({
  branchId: idSchema,
  supplierId: idSchema,
  supplierInvoice: z.string().trim().min(1).max(80),
  purchasedAt: z.string().date(),
  dueAt: z.string().date(),
  items: z.array(z.object({
    ingredientId: idSchema.optional(),
    productId: idSchema.optional(),
    quantity: z.coerce.number().positive(),
    unitCost: z.coerce.number().nonnegative()
  }).refine((item) => Boolean(item.ingredientId) !== Boolean(item.productId), {
    message: "Cada línea debe referir a un insumo o producto empacado, no ambos."
  })).min(1)
}).refine((purchase) => purchase.dueAt >= purchase.purchasedAt, {
  path: ["dueAt"],
  message: "El vencimiento no puede ser anterior a la fecha de compra."
});
