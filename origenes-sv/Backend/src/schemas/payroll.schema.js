import { z } from "zod";
import { idSchema } from "./common.schema.js";

export const payrollSchema = z.object({
  branchId: idSchema,
  periodStart: z.string().date(),
  periodEnd: z.string().date()
}).superRefine((period, context) => {
  if (period.periodEnd < period.periodStart) {
    context.addIssue({
      code: "custom",
      path: ["periodEnd"],
      message: "La fecha final debe ser igual o posterior a la inicial."
    });
    return;
  }
  const start = new Date(`${period.periodStart}T00:00:00.000Z`);
  const end = new Date(`${period.periodEnd}T00:00:00.000Z`);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear()
    && start.getUTCMonth() === end.getUTCMonth();
  const isQuincena = sameMonth
    && ((start.getUTCDate() === 1 && end.getUTCDate() === 15)
      || (start.getUTCDate() === 16 && end.getUTCDate() === lastDay));

  if (!isQuincena) {
    context.addIssue({
      code: "custom",
      path: ["periodEnd"],
      message: "Use una quincena completa: del 1 al 15 o del 16 al último día del mismo mes."
    });
  }
});
