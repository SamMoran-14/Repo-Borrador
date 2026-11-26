import { pool, inTransaction } from "../config/db.js";
import { fail } from "../utils/errors.js";

export async function listProducts() {
  const result = await pool.query(
    `SELECT p.id, p.sku, p.name, p.category, p.price, p.product_type AS "productType",
            COALESCE(json_agg(json_build_object(
              'ingredientId', i.id, 'ingredient', i.name, 'unit', i.unit, 'quantity', ri.quantity
            )) FILTER (WHERE i.id IS NOT NULL), '[]'::JSON) AS recipe
     FROM products p
     LEFT JOIN recipe_items ri ON ri.product_id = p.id
     LEFT JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE p.active = TRUE
     GROUP BY p.id ORDER BY p.category, p.name`
  );
  return result.rows;
}

// Receta de un producto (insumo, unidad base y cantidad por unidad vendida).
export async function getRecipe(productId) {
  const result = await pool.query(
    `SELECT ri.ingredient_id AS "ingredientId", i.name AS ingredient, i.unit, ri.quantity
     FROM recipe_items ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.product_id = $1
     ORDER BY i.name`,
    [productId]
  );
  return result.rows;
}

async function assertIngredientsAvailable(client, items) {
  const ingredientIds = items.map((item) => item.ingredientId);
  const found = await client.query(
    "SELECT id FROM ingredients WHERE id = ANY($1::INTEGER[]) AND active = TRUE",
    [ingredientIds]
  );
  if (found.rowCount !== ingredientIds.length) {
    throw fail(400, "Uno o más ingredientes no están disponibles.");
  }
}

// Crea un producto elaborado junto con su receta.
// Todo en una transacción: o se crea el producto con toda su receta, o no se crea nada.
export function createProduct(data) {
  return inTransaction(async (client) => {
    const duplicate = await client.query(
      "SELECT id FROM products WHERE LOWER(name) = LOWER($1)",
      [data.name]
    );
    if (duplicate.rowCount) throw fail(409, "Ya existe un producto con ese nombre.");

    await assertIngredientsAvailable(client, data.items);

    // SKU automático: REC-001, REC-002, ...
    const next = await client.query(
      `SELECT COALESCE(MAX(SUBSTRING(sku FROM 5)::INTEGER), 0) + 1 AS n
       FROM products WHERE sku ~ '^REC-[0-9]+$'`
    );
    const sku = `REC-${String(next.rows[0].n).padStart(3, "0")}`;

    const created = await client.query(
      `INSERT INTO products (sku, name, category, price, product_type)
       VALUES ($1, $2, $3, $4, 'RECIPE') RETURNING id`,
      [sku, data.name, data.category, data.price]
    );
    for (const item of data.items) {
      await client.query(
        "INSERT INTO recipe_items (product_id, ingredient_id, quantity) VALUES ($1, $2, $3)",
        [created.rows[0].id, item.ingredientId, item.quantity]
      );
    }
    return { id: created.rows[0].id, sku };
  });
}

// Reemplaza la receta completa de un producto.
// Todo ocurre en una transacción: si algo falla, la receta anterior se conserva.
export function replaceRecipe(productId, data) {
  return inTransaction(async (client) => {
    const product = await client.query(
      `SELECT id FROM products
       WHERE id = $1 AND product_type = 'RECIPE' AND active = TRUE FOR UPDATE`,
      [productId]
    );
    if (!product.rowCount) throw fail(404, "El producto no existe o no maneja receta.");

    await assertIngredientsAvailable(client, data.items);

    await client.query("DELETE FROM recipe_items WHERE product_id = $1", [productId]);
    for (const item of data.items) {
      await client.query(
        "INSERT INTO recipe_items (product_id, ingredient_id, quantity) VALUES ($1, $2, $3)",
        [productId, item.ingredientId, item.quantity]
      );
    }
  });
}
