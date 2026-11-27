// Crea un error con código HTTP para que el manejador de errores lo traduzca a una respuesta.
export function fail(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

// Traduce cualquier error (PostgreSQL, validación, HTTP o inesperado) a una respuesta JSON.
export function handleError(error, res) {
  if (error.code === "23505") {
    return res.status(409).json({ error: "El registro ya existe o duplica un dato único." });
  }
  if (error.code === "23503") {
    return res.status(400).json({ error: "La referencia seleccionada no existe." });
  }
  if (error.code === "23514" || error.code === "22P02" || error.code === "22003") {
    return res.status(400).json({ error: "Los datos no cumplen las reglas del sistema." });
  }
  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: "Ocurrió un error interno. Intente de nuevo." });
}
