import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createUser, findUserByEmail, findUserById } from "./db.js";
import { newId } from "./store.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "30d";

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function registerUser(email, password) {
  if (findUserByEmail(email)) {
    const err = new Error("An account with this email already exists.");
    err.statusCode = 409;
    throw err;
  }
  const user = { id: newId("us"), email, passwordHash: hashPassword(password) };
  createUser(user);
  return { user: { id: user.id, email }, token: signToken(user.id) };
}

export function loginUser(email, password) {
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    const err = new Error("Invalid email or password.");
    err.statusCode = 401;
    throw err;
  }
  return { user: { id: user.id, email: user.email }, token: signToken(user.id) };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.user = findUserById(payload.sub);
    if (!req.user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Account not found." } });
    }
    next();
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token." } });
  }
}
