import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  taxId: z.string().trim().max(30).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(255).default("").refine(
    (value) => value === "" || z.string().email().safeParse(value).success,
    { message: "El correo no tiene un formato válido." }
  )
});
