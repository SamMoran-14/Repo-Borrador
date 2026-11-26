import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { fail } from "../utils/errors.js";

const USER_COLUMNS = "id, email, password_hash, full_name, role, session_version";

export async function createAdminUser() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Configure ADMIN_EMAIL y ADMIN_PASSWORD para crear el usuario administrador inicial.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount > 0) return;

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    "INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'ADMIN')",
    [email, hash, "Administración Orígenes"]
  );
}

export async function verifyCredentials({ email, password }) {
  const result = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users WHERE email = $1 AND active = TRUE`,
    [email]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw fail(401, "Correo o contraseña incorrectos.");
  }
  return user;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const result = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND active = TRUE`,
    [userId]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw fail(401, "La contraseña actual es incorrecta.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await pool.query(
    `UPDATE users
     SET password_hash = $1, session_version = session_version + 1
     WHERE id = $2 AND session_version = $3 AND active = TRUE
     RETURNING id, email, full_name, role, session_version`,
    [passwordHash, user.id, user.session_version]
  );
  if (!updated.rowCount) {
    throw fail(409, "La contraseña cambió en otra sesión. Vuelve a iniciar sesión.");
  }
  return updated.rows[0];
}
