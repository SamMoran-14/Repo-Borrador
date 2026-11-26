import { pool } from "../config/db.js";

export async function getDashboard(branchId) {
  const [sales, lowStock, payables, shift] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::INTEGER AS orders, COALESCE(SUM(total), 0)::NUMERIC(12,2) AS revenue
       FROM sales WHERE branch_id = $1 AND created_at::DATE = CURRENT_DATE`,
      [branchId]
    ),
    pool.query(
      `SELECT COUNT(*)::INTEGER AS count FROM (
         SELECT i.id
         FROM ingredients i
         JOIN inventory_balances b ON b.ingredient_id = i.id AND b.branch_id = $1
         WHERE i.active = TRUE AND b.quantity <= i.minimum_stock
         UNION ALL
         SELECT p.id
         FROM products p
         JOIN inventory_balances b ON b.product_id = p.id AND b.branch_id = $1
         WHERE p.active = TRUE AND p.product_type = 'RESALE' AND b.quantity <= 5
       ) alerts`,
      [branchId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount - paid_amount), 0)::NUMERIC(12,2) AS outstanding
       FROM accounts_payable ap
       JOIN purchases p ON p.id = ap.purchase_id
       WHERE p.branch_id = $1 AND ap.status <> 'PAID'`,
      [branchId]
    ),
    pool.query(
      `SELECT id, opening_amount, opened_at
       FROM cash_shifts WHERE branch_id = $1 AND status = 'OPEN'`,
      [branchId]
    )
  ]);
  return {
    todayOrders: sales.rows[0].orders,
    todayRevenue: Number(sales.rows[0].revenue),
    lowStockCount: lowStock.rows[0].count,
    outstandingPayables: Number(payables.rows[0].outstanding),
    cashShift: shift.rows[0] || null
  };
}
