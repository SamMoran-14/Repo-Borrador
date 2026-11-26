import { loginSchema, passwordChangeSchema } from "../schemas/auth.schema.js";
import { changePassword, verifyCredentials } from "../services/authService.js";
import { createToken } from "../utils/token.js";
import { parseOrRespond } from "../utils/validation.js";

// El secreto JWT se inyecta desde createApp para poder probar la API con otro secreto.
export function createAuthController({ jwtSecret }) {
  return {
    async login(req, res) {
      const data = parseOrRespond(loginSchema, req.body, res);
      if (!data) return;
      const user = await verifyCredentials(data);
      res.json({
        token: createToken(user, jwtSecret),
        user: { id: user.id, email: user.email, name: user.full_name, role: user.role }
      });
    },

    me(req, res) {
      res.json({
        id: Number(req.user.sub),
        name: req.user.name,
        role: req.user.role
      });
    },

    async changePassword(req, res) {
      const data = parseOrRespond(passwordChangeSchema, req.body, res);
      if (!data) return;
      const updatedUser = await changePassword(req.user.sub, data);
      res.json({ token: createToken(updatedUser, jwtSecret) });
    }
  };
}
