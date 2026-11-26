import { z } from "zod";
import { idSchema, paymentMethods } from "./common.schema.js";

export const saleSchema = z.object({
  branchId: idSchema,
  documentType: z.enum(["CONSUMER_FINAL", "CCF"]),
  paymentMethod: z.enum(paymentMethods),
  items: z.array(z.object({
    productId: idSchema,
    quantity: z.coerce.number().int().positive()
  })).min(1)
});
