import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200)
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12, "La nueva contraseña debe tener al menos 12 caracteres.").max(200)
}).refine((passwords) => passwords.currentPassword !== passwords.newPassword, {
  path: ["newPassword"],
  message: "La nueva contraseña debe ser diferente a la actual."
});
