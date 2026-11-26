import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function limiter(limit) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });
}

export const createLoginLimit = () => limiter(10);
export const createPasswordChangeLimit = () => limiter(5);
