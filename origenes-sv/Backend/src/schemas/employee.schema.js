import { z } from "zod";
import { idSchema } from "./common.schema.js";

export const employeeSchema = z.object({
  branchId: idSchema,
  fullName: z.string().trim().min(2).max(160),
  position: z.string().trim().min(2).max(100),
  monthlySalary: z.coerce.number().positive().max(1_000_000)
});
