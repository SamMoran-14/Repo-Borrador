import { pool, inTransaction } from "../config/db.js";
import { VAT_RATE, roundMoney } from "../domain/domain.js";
import { fail } from "../utils/errors.js";

export async function listPurchases(branchId) {
  const result = await pool.query(
    `SELECT p.id, p.supplier_invoice AS "supplierInvoice", p.purchased_at AS "purchasedAt",
            p.due_at AS "dueAt", p.subtotal, p.tax, p.total, s.name AS supplier, p.supplier_id AS "supplierId",
            ap.amount - ap.paid_amount AS outstanding, ap.status
     FROM purchases p
     JOIN suppliers s ON s.id = p.supplier_id
     JOIN accounts_payable ap ON ap.purchase_id = p.id
     WHERE p.branch_id = $1
     ORDER BY p.created_at DESC LIMIT 100`,
    [branchId]
  );
  return result.rows;
}

// Suma `quantity` al saldo de inventario de un insumo o de un producto empacado.
async function addToInventory(client, branchId, item) {
  if (item.ingredientId) {
    await client.query(
      `INSERT INTO inventory_balances (branch_id, ingredient_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (branch_id, ingredient_id) WHERE ingredient_id IS NOT NULL
       DO UPDATE SET quantity = inventory_balances.quantity + EXCLUDED.quantity, updated_at = NOW()`,
      [branchId, item.ingredientId, item.quantity]
    );
  } else {
    await client.query(
      `INSERT INTO inventory_balances (branch_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (branch_id, product_id) WHERE product_id IS NOT NULL
       DO UPDATE SET quantity = inventory_balances.quantity + EXCLUDED.quantity, updated_at = NOW()`,
      [branchId, item.productId, item.quantity]
    );
  }
}

// Registra una compra: cabecera, líneas, entrada a inventario y cuenta por pagar.
export function createPurchase(data, userId) {
  return inTransaction(async (client) => {
    let subtotal = 0;
    const lines = data.items.map((item) => {
      const lineTotal = roundMoney(item.quantity * item.unitCost);
      subtotal = roundMoney(subtotal + lineTotal);
      return { ...item, lineTotal };
    });
    const tax = roundMoney(subtotal * VAT_RATE);
    const total = roundMoney(subtotal + tax);
    const header = await client.query(
      `INSERT INTO purchases
         (branch_id, supplier_id, supplier_invoice, purchased_at, due_at, subtotal, tax, total, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [data.branchId, data.supplierId, data.supplierInvoice, data.purchasedAt, data.dueAt,
        subtotal, tax, total, userId]
    );
    const purchaseId = header.rows[0].id;
    for (const item of lines) {
      await client.query(
        `INSERT INTO purchase_items
           (purchase_id, ingredient_id, product_id, quantity, unit_cost, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [purchaseId, item.ingredientId || null, item.productId || null, item.quantity, item.unitCost, item.lineTotal]
      );
      await addToInventory(client, data.branchId, item);
    }
    await client.query(
      `INSERT INTO accounts_payable (purchase_id, amount, due_at) VALUES ($1, $2, $3)`,
      [purchaseId, total, data.dueAt]
    );
    return { id: purchaseId, subtotal, tax, total };
  });
}

// Elimina una factura de compra.
// Deshace lo que hizo al registrarse: resta del inventario lo que había sumado y quita su
// cuenta por pagar. Todo en una transacción: o se deshace completo, o no se toca nada.
export function deletePurchase(purchaseId) {
  return inTransaction(async (client) => {
    const purchase = await client.query(
      "SELECT id, branch_id FROM purchases WHERE id = $1 FOR UPDATE",
      [purchaseId]
    );
    if (!purchase.rowCount) throw fail(404, "La factura no existe o ya fue eliminada.");

    // Si ya se abonó algo, borrar la factura dejaría los pagos sin respaldo
    const payable = await client.query(
      "SELECT paid_amount FROM accounts_payable WHERE purchase_id = $1 FOR UPDATE",
      [purchaseId]
    );
    if (payable.rows[0] && Number(payable.rows[0].paid_amount) > 0) {
      throw fail(409, "No se puede eliminar: la factura ya tiene pagos registrados.");
    }

    const items = await client.query(
      "SELECT ingredient_id, product_id, quantity FROM purchase_items WHERE purchase_id = $1",
      [purchaseId]
    );
    for (const item of items.rows) {
      const column = item.ingredient_id ? "ingredient_id" : "product_id";
      const itemId = item.ingredient_id || item.product_id;
      // Solo resta si alcanza: si lo comprado ya se vendió o se usó, el inventario quedaría negativo
      const updated = await client.query(
        `UPDATE inventory_balances SET quantity = quantity - $1, updated_at = NOW()
         WHERE branch_id = $2 AND ${column} = $3 AND quantity >= $1
         RETURNING id`,
        [item.quantity, purchase.rows[0].branch_id, itemId]
      );
      if (!updated.rowCount) {
        throw fail(409, "No se puede eliminar: parte de lo comprado ya se usó o se vendió.");
      }
    }

    await client.query("DELETE FROM accounts_payable WHERE purchase_id = $1", [purchaseId]);
    await client.query("DELETE FROM purchase_items WHERE purchase_id = $1", [purchaseId]);
    await client.query("DELETE FROM purchases WHERE id = $1", [purchaseId]);
  });
}
