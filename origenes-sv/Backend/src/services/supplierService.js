import { pool } from "../config/db.js";
import { fail } from "../utils/errors.js";

export async function listSuppliers() {
  const result = await pool.query(
    "SELECT id, name, tax_id AS \"taxId\", phone, email FROM suppliers WHERE active = TRUE ORDER BY name"
  );
  return result.rows;
}

// Crea un proveedor. Si existía uno eliminado con el mismo nombre, se reactiva con los datos nuevos.
export async function createSupplier(data) {
  const result = await pool.query(
    `INSERT INTO suppliers (name, tax_id, phone, email) VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE
       SET tax_id = EXCLUDED.tax_id, phone = EXCLUDED.phone, email = EXCLUDED.email, active = TRUE
       WHERE suppliers.active = FALSE
     RETURNING id, name, tax_id AS "taxId", phone, email`,
    [data.name, data.taxId, data.phone, data.email]
  );
  // Sin fila devuelta: ya hay un proveedor ACTIVO con ese nombre
  if (!result.rowCount) throw fail(409, "Ya existe un proveedor activo con ese nombre.");
  return result.rows[0];
}

// Elimina (desactiva) un proveedor. No se borra la fila para conservar el historial
// de compras, y se bloquea si todavía hay cuentas por pagar pendientes con ese proveedor.
export async function deactivateSupplier(supplierId) {
  const pending = await pool.query(
    `SELECT COUNT(*)::INTEGER AS count
     FROM accounts_payable ap
     JOIN purchases p ON p.id = ap.purchase_id
     WHERE p.supplier_id = $1 AND ap.status <> 'PAID'`,
    [supplierId]
  );
  if (pending.rows[0].count > 0) {
    throw fail(409, "No se puede eliminar: el proveedor tiene cuentas por pagar pendientes.");
  }
  const result = await pool.query(
    "UPDATE suppliers SET active = FALSE WHERE id = $1 AND active = TRUE",
    [supplierId]
  );
  if (!result.rowCount) throw fail(404, "El proveedor no existe o ya fue eliminado.");
}
