import { idSchema } from "../schemas/common.schema.js";

// Valida `input` con un esquema Zod. Si falla, responde 400 y devuelve null.
export function parseOrRespond(schema, input, res) {
  const result = schema.safeParse(input);
  if (!result.success) {
    res.status(400).json({
      error: "Revise los datos enviados.",
      details: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });
    return null;
  }
  return result.data;
}

// Valida un identificador numérico positivo. Si falla, responde 400 y devuelve null.
export function requireId(value, res, label = "identificador") {
  const id = idSchema.safeParse(value);
  if (!id.success) {
    res.status(400).json({ error: `El ${label} no es válido.` });
    return null;
  }
  return id.data;
}
