import * as sqlite from "./db-sqlite.js";
import * as supabase from "./db-supabase.js";

// Facade: use Supabase (Postgres) when DATABASE_URL is set, otherwise local SQLite.
// All callers keep the same synchronous signatures, so nothing else changes.
async function safe(fnName, ...args) {
  if (process.env.DATABASE_URL) {
    try {
      return await supabase[fnName](...args);
    } catch (err) {
      console.warn(`[db] Supabase operation ${fnName} failed (${err.message}). Using SQLite.`);
    }
  }
  return sqlite[fnName](...args);
}

export const createUser = (a, b, c, d) => safe("createUser", { id: a, email: b, passwordHash: c });
export const findUserByEmail = (a) => safe("findUserByEmail", a);
export const findUserById = (a) => safe("findUserById", a);
export const upsertScan = (a) => safe("upsertScan", a);
export const listUserScans = (a, b) => safe("listUserScans", a, b);
export const saveChatMessage = (a) => safe("saveChatMessage", a);
export const listChatMessages = (a, b) => safe("listChatMessages", a, b);