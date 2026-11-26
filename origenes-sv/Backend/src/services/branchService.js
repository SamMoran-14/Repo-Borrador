import { pool } from "../config/db.js";

export async function listActiveBranches() {
  const result = await pool.query(
    "SELECT id, code, name, address FROM branches WHERE active = TRUE ORDER BY name"
  );
  return result.rows;
}
