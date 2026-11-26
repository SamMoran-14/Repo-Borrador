import { pool, inTransaction } from "../config/db.js";
import { fail } from "../utils/errors.js";

export async function listInventory(branchId) {
  const result = await pool.query(
    `SELECT 'INGREDIENT' AS type, i.id, i.name, i.unit, b.quantity,
            i.minimum_stock AS "minimumStock", b.quantity <= i.minimum_stock AS "lowStock"
     FROM ingredients i
     JOIN inventory_balances b ON b.ingredient_id = i.id AND b.branch_id = $1
     WHERE i.active = TRUE
     UNION ALL
     SELECT 'RESALE' AS type, p.id, p.name, 'unidad' AS unit, b.quantity,
            5::NUMERIC AS "minimumStock", b.quantity <= 5 AS "lowStock"
     FROM products p
     JOIN inventory_balances b ON b.product_id = p.id AND b.branch_id = $1
     WHERE p.product_type = 'RESALE' AND p.active = TRUE
     ORDER BY "lowStock" DESC, name`,
    [branchId]
  );
  return result.rows;
}

// Crea un artículo (insumo o producto empacado).
// Crea el saldo en todas las sucursales: la existencia inicial va en la
// sucursal seleccionada y las demás empiezan en 0.
export function createInventoryItem(data) {
  return inTransaction(async (client) => {
    let created;

    if (data.type === "INGREDIENT") {
      // Si existía uno eliminado con el mismo nombre, se reactiva.
      created = await client.query(
        `INSERT INTO ingredients (name, unit, minimum_stock) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE
           SET unit = EXCLUDED.unit, minimum_stock = EXCLUDED.minimum_stock, active = TRUE
           WHERE ingredients.active = FALSE
         RETURNING id`,
        [data.name, data.unit, data.minimumStock]
      );
    } else {
      // SKU automático: EMP-001, EMP-002, ...
      const next = await client.query(
        `SELECT COALESCE(MAX(SUBSTRING(sku FROM 5)::INTEGER), 0) + 1 AS n
         FROM products WHERE sku ~ '^EMP-[0-9]+$'`
      );
      const sku = `EMP-${String(next.rows[0].n).padStart(3, "0")}`;
      created = await client.query(
        `INSERT INTO products (sku, name, category, price, product_type)
         VALUES ($1, $2, 'Empacados', $3, 'RESALE')
         ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price, active = TRUE
           WHERE products.active = FALSE AND products.product_type = 'RESALE'
         RETURNING id`,
        [sku, data.name, data.price]
      );
    }

    // Si el INSERT no devolvió fila, ya existe un artículo ACTIVO con ese nombre.
    if (!created.rowCount) throw fail(409, "Ya existe un artículo activo con ese nombre.");
    const id = created.rows[0].id;

    const column = data.type === "INGREDIENT" ? "ingredient_id" : "product_id";
    await client.query(
      `INSERT INTO inventory_balances (branch_id, ${column}, quantity)
       SELECT b.id, $1::INTEGER, CASE WHEN b.id = $2 THEN $3::NUMERIC ELSE 0 END
       FROM branches b WHERE b.active = TRUE
       ON CONFLICT (branch_id, ${column}) WHERE ${column} IS NOT NULL
       DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
      [id, data.branchId, data.quantity]
    );
    return { id, type: data.type };
  });
}

// Eliminar artículo = desactivarlo (active = FALSE).
// No se borra la fila para conservar el historial de ventas y compras.
export async function deactivateInventoryItem(type, id) {
  let result;
  if (type === "INGREDIENT") {
    // No se puede quitar un insumo que usa la receta de un producto activo.
    const used = await pool.query(
      `SELECT p.name FROM recipe_items ri
       JOIN products p ON p.id = ri.product_id
       WHERE ri.ingredient_id = $1 AND p.active = TRUE
       ORDER BY p.name LIMIT 3`,
      [id]
    );
    if (used.rowCount) {
      throw fail(409, `No se puede eliminar: forma parte de la receta de ${used.rows.map((row) => row.name).join(", ")}.`);
    }
    result = await pool.query("UPDATE ingredients SET active = FALSE WHERE id = $1 AND active = TRUE", [id]);
  } else {
    result = await pool.query(
      "UPDATE products SET active = FALSE WHERE id = $1 AND product_type = 'RESALE' AND active = TRUE",
      [id]
    );
  }
  if (!result.rowCount) throw fail(404, "El artículo no existe o ya fue eliminado.");
}
