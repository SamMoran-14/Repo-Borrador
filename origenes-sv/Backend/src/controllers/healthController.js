import { pool } from "../config/db.js";

export async function health(_req, res) {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
}
