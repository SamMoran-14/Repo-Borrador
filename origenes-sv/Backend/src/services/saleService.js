import { inTransaction } from "../config/db.js";
import {
  calculateRecipeRequirements,
  calculateSaleTotals,
  roundMoney,
  roundQuantity
} from "../domain/domain.js";
import { fail } from "../utils/errors.js";

// Acumula los insumos que consumen las líneas de recetas y los descuenta del inventario.
async function consumeRecipeIngredients(client, branchId, recipeLines) {
  const recipes = await client.query(
    `SELECT product_id AS "productId", ingredient_id AS "ingredientId", quantity
     FROM recipe_items WHERE product_id = ANY($1::INTEGER[])`,
    [recipeLines.map((item) => item.productId)]
  );
  const recipeMap = new Map();
  for (const row of recipes.rows) {
    const list = recipeMap.get(row.productId) || [];
    list.push({ ingredientId: row.ingredientId, quantity: Number(row.quantity) });
    recipeMap.set(row.productId, list);
  }

  const requirements = new Map();
  for (const item of recipeLines) {
    const recipe = recipeMap.get(item.productId);
    if (!recipe?.length) throw fail(409, `El producto "${item.productName}" no tiene receta configurada.`);
    for (const requirement of calculateRecipeRequirements(recipe, item.quantity)) {
      requirements.set(
        requirement.ingredientId,
        roundQuantity((requirements.get(requirement.ingredientId) || 0) + requirement.quantity)
      );
    }
  }

  for (const [ingredientId, quantity] of requirements) {
    const updated = await client.query(
      `UPDATE inventory_balances SET quantity = quantity - $1, updated_at = NOW()
       WHERE branch_id = $2 AND ingredient_id = $3 AND quantity >= $1
       RETURNING id`,
      [quantity, branchId, ingredientId]
    );
    if (!updated.rowCount) {
      const ingredient = await client.query("SELECT name FROM ingredients WHERE id = $1", [ingredientId]);
      throw fail(409, `Inventario insuficiente para ${ingredient.rows[0]?.name || "un insumo"}.`);
    }
  }
}

// Descuenta del inventario las unidades de productos de reventa.
async function consumeResaleProducts(client, branchId, resaleLines) {
  for (const item of resaleLines) {
    const updated = await client.query(
      `UPDATE inventory_balances SET quantity = quantity - $1, updated_at = NOW()
       WHERE branch_id = $2 AND product_id = $3 AND quantity >= $1 RETURNING id`,
      [item.quantity, branchId, item.productId]
    );
    if (!updated.rowCount) throw fail(409, `Inventario insuficiente para ${item.productName}.`);
  }
}

// Genera el correlativo por sucursal, tipo de documento y año, y crea el comprobante interno.
async function issueInvoice(client, { saleId, branchId, documentType, totals }) {
  const fiscalYear = new Date().getFullYear();
  const sequence = await client.query(
    `INSERT INTO invoice_counters (branch_id, document_type, fiscal_year, next_number)
     VALUES ($1, $2, $3, 2)
     ON CONFLICT (branch_id, document_type, fiscal_year)
     DO UPDATE SET next_number = invoice_counters.next_number + 1
     RETURNING next_number - 1 AS sequence_number`,
    [branchId, documentType, fiscalYear]
  );
  const branch = await client.query("SELECT code FROM branches WHERE id = $1", [branchId]);
  const invoiceSequence = sequence.rows[0].sequence_number;
  const prefix = documentType === "CCF" ? "CCF" : "FC";
  const invoiceNumber = `${prefix}-${branch.rows[0].code}-${fiscalYear}-${String(invoiceSequence).padStart(6, "0")}`;
  const invoice = await client.query(
    `INSERT INTO invoices
       (sale_id, branch_id, document_type, fiscal_year, sequence_number, invoice_number, subtotal, tax, total)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING invoice_number AS "invoiceNumber"`,
    [saleId, branchId, documentType, fiscalYear, invoiceSequence,
      invoiceNumber, totals.subtotal, totals.tax, totals.total]
  );
  return invoice.rows[0].invoiceNumber;
}

// Registra una venta completa en una sola transacción:
// valida caja abierta y productos, descuenta inventario, guarda la venta y emite el comprobante.
export function createSale(data, userId) {
  return inTransaction(async (client) => {
    const shift = await client.query(
      `SELECT id FROM cash_shifts
       WHERE branch_id = $1 AND status = 'OPEN' FOR UPDATE`,
      [data.branchId]
    );
    if (!shift.rows[0]) throw fail(409, "Abra la caja de la sucursal antes de registrar ventas.");

    const productIds = [...new Set(data.items.map((item) => item.productId))];
    const products = await client.query(
      `SELECT id, sku, name, price, product_type FROM products
       WHERE id = ANY($1::INTEGER[]) AND active = TRUE`,
      [productIds]
    );
    if (products.rowCount !== productIds.length) throw fail(400, "Uno o más productos no están disponibles.");
    const productById = new Map(products.rows.map((product) => [product.id, product]));
    const saleLines = data.items.map((item) => {
      const product = productById.get(item.productId);
      return {
        ...item,
        unitPrice: Number(product.price),
        productName: product.name,
        productType: product.product_type,
        lineTotal: roundMoney(Number(product.price) * item.quantity)
      };
    });
    const totals = calculateSaleTotals(saleLines);

    const recipeLines = saleLines.filter((item) => item.productType === "RECIPE");
    const resaleLines = saleLines.filter((item) => item.productType === "RESALE");
    if (recipeLines.length) await consumeRecipeIngredients(client, data.branchId, recipeLines);
    await consumeResaleProducts(client, data.branchId, resaleLines);

    const header = await client.query(
      `INSERT INTO sales
         (branch_id, cash_shift_id, cashier_id, payment_method, subtotal, tax, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [data.branchId, shift.rows[0].id, userId, data.paymentMethod,
        totals.subtotal, totals.tax, totals.total]
    );
    const saleId = header.rows[0].id;
    for (const item of saleLines) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [saleId, item.productId, item.productName, item.quantity, item.unitPrice, item.lineTotal]
      );
    }
    const invoice = await issueInvoice(client, {
      saleId,
      branchId: data.branchId,
      documentType: data.documentType,
      totals
    });
    return { id: saleId, invoice, ...totals };
  });
}
