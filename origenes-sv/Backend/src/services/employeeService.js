import { pool } from "../config/db.js";

export async function listEmployees(branchId) {
  const result = await pool.query(
    `SELECT id, full_name AS "fullName", position, monthly_salary AS "monthlySalary"
     FROM employees WHERE active = TRUE AND (branch_id = $1 OR branch_id IS NULL)
     ORDER BY full_name`,
    [branchId]
  );
  return result.rows;
}

export async function createEmployee(data) {
  const result = await pool.query(
    `INSERT INTO employees (branch_id, full_name, position, monthly_salary)
     VALUES ($1, $2, $3, $4)
     RETURNING id, full_name AS "fullName", position, monthly_salary AS "monthlySalary"`,
    [data.branchId, data.fullName, data.position, data.monthlySalary]
  );
  return result.rows[0];
}
