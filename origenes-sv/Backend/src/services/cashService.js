import { pool, inTransaction } from "../config/db.js";
import { reconcileCash } from "../domain/domain.js";
import { fail } from "../utils/errors.js";

// Totales vendidos en un turno, agrupados por medio de pago: { CASH: 10, CARD: 5, ... }
async function salesByMethod(db, shiftId) {
  const totals = await db.query(
    `SELECT payment_method AS method, COALESCE(SUM(total), 0)::NUMERIC(12,2) AS total
     FROM sales WHERE cash_shift_id = $1 GROUP BY payment_method`,
    [shiftId]
  );
  return Object.fromEntries(totals.rows.map((row) => [row.method, Number(row.total)]));
}

export async function getCashStatus(branchId) {
  const result = await pool.query(
    `SELECT id, opening_amount AS "openingAmount", opened_at AS "openedAt"
     FROM cash_shifts WHERE branch_id = $1 AND status = 'OPEN'`,
    [branchId]
  );
  if (!result.rows[0]) return { shift: null, totals: {} };
  return { shift: result.rows[0], totals: await salesByMethod(pool, result.rows[0].id) };
}

export async function openCash({ branchId, openingAmount }, userId) {
  const result = await pool.query(
    `INSERT INTO cash_shifts (branch_id, opened_by, opening_amount)
     VALUES ($1, $2, $3) RETURNING id, opening_amount AS "openingAmount", opened_at AS "openedAt"`,
    [branchId, userId, openingAmount]
  );
  return result.rows[0];
}

export function closeCash(data, userId) {
  return inTransaction(async (client) => {
    const shift = await client.query(
      `SELECT id, opening_amount FROM cash_shifts
       WHERE branch_id = $1 AND status = 'OPEN' FOR UPDATE`,
      [data.branchId]
    );
    if (!shift.rows[0]) throw fail(409, "No hay una caja abierta en esta sucursal.");

    const sales = await salesByMethod(client, shift.rows[0].id);
    const reconciliation = reconcileCash({
      openingAmount: Number(shift.rows[0].opening_amount),
      sales,
      counted: {
        CASH: data.countedCash,
        CARD: data.countedCard,
        BITCOIN: data.countedBitcoin,
        CHIVO: data.countedChivo
      }
    });
    await client.query(
      `UPDATE cash_shifts SET closed_by = $1, closed_at = NOW(), counted_cash = $2,
         counted_card = $3, counted_bitcoin = $4, counted_chivo = $5, difference = $6,
         cash_difference = $7, card_difference = $8, bitcoin_difference = $9, chivo_difference = $10,
         status = 'CLOSED'
       WHERE id = $11`,
      [userId, data.countedCash, data.countedCard, data.countedBitcoin, data.countedChivo,
        reconciliation.difference, reconciliation.differences.CASH, reconciliation.differences.CARD,
        reconciliation.differences.BITCOIN, reconciliation.differences.CHIVO, shift.rows[0].id]
    );
    return { expectedCash: reconciliation.expected.CASH, ...reconciliation };
  });
}
