import { pool, inTransaction } from "../config/db.js";
import { calculatePayroll } from "../domain/domain.js";
import { fail } from "../utils/errors.js";

export async function listPayrollRuns() {
  const result = await pool.query(
    `SELECT r.id, r.period_start AS "periodStart", r.period_end AS "periodEnd",
            SUM(l.gross)::NUMERIC(12,2) AS gross,
            SUM(l.net)::NUMERIC(12,2) AS net,
            COUNT(l.id)::INTEGER AS employees
     FROM payroll_runs r JOIN payroll_lines l ON l.payroll_run_id = r.id
     GROUP BY r.id ORDER BY r.created_at DESC LIMIT 50`
  );
  return result.rows;
}

export function createPayroll(data, userId) {
  return inTransaction(async (client) => {
    const employees = await client.query(
      `SELECT id, full_name, monthly_salary FROM employees
       WHERE active = TRUE AND (branch_id = $1 OR branch_id IS NULL) ORDER BY id`,
      [data.branchId]
    );
    if (!employees.rowCount) throw fail(409, "Registre empleados activos antes de generar la planilla.");
    const run = await client.query(
      `INSERT INTO payroll_runs (branch_id, period_start, period_end, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [data.branchId, data.periodStart, data.periodEnd, userId]
    );
    const lines = [];
    for (const employee of employees.rows) {
      const amounts = calculatePayroll(Number(employee.monthly_salary));
      await client.query(
        `INSERT INTO payroll_lines
           (payroll_run_id, employee_id, employee_name, monthly_salary, gross, isss, afp, taxable_income, income_tax, net)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [run.rows[0].id, employee.id, employee.full_name, employee.monthly_salary,
          amounts.gross, amounts.isss, amounts.afp, amounts.taxableIncome, amounts.incomeTax, amounts.net]
      );
      lines.push({ employee: employee.full_name, ...amounts });
    }
    return { id: run.rows[0].id, periodStart: data.periodStart, periodEnd: data.periodEnd, lines };
  });
}
