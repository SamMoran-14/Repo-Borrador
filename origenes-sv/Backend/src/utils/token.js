import jwt from "jsonwebtoken";
import { TOKEN_ISSUER } from "../middlewares/authenticate.js";

export function createToken(user, secret) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      name: user.full_name,
      ver: user.session_version ?? 0
    },
    secret,
    { expiresIn: "8h", issuer: TOKEN_ISSUER }
  );
}
