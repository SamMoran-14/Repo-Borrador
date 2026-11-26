import { handleError } from "../utils/errors.js";

// Último middleware de Express. En Express 5 los errores lanzados (o promesas rechazadas)
// dentro de los controladores llegan aquí automáticamente.
export function errorHandler(error, _req, res, _next) {
  handleError(error, res);
}

export function apiNotFound(_req, res) {
  res.status(404).json({ error: "Recurso API no encontrado." });
}
