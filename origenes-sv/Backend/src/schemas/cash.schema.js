import { z } from "zod";
import { idSchema, moneySchema } from "./common.schema.js";

export const openCashSchema = z.object({
  branchId: idSchema,
  openingAmount: moneySchema
});

export const closeCashSchema = z.object({
  branchId: idSchema,
  countedCash: moneySchema,
  countedCard: moneySchema,
  countedBitcoin: moneySchema,
  countedChivo: moneySchema
});
