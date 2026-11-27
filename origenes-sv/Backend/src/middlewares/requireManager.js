// Solo ADMIN y MANAGER pueden crear, editar o eliminar (inventario, recetas, proveedores, compras).
export function requireManager(req, res, next) {
  if (!["ADMIN", "MANAGER"].includes(req.user?.role)) {
    return res.status(403).json({ error: "No tiene permisos para realizar esta acción." });
  }
  next();
}
