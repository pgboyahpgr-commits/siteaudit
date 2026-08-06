import * as sqlite from "./db-sqlite.js";
import * as supabase from "./db-supabase.js";

// Facade: use Supabase (Postgres) when DATABASE_URL is set, otherwise local SQLite.
// All callers keep the same synchronous signatures, so nothing else changes.
const pick = () => (process.env.DATABASE_URL ? supabase : sqlite);

export const dbKind = () => (process.env.DATABASE_URL ? "supabase" : "sqlite");
export const db = sqlite.db;

export const createUser = (a, b, c, d) => pick().createUser(a, b, c, d);
export const findUserByEmail = (a) => pick().findUserByEmail(a);
export const findUserById = (a) => pick().findUserById(a);
export const upsertScan = (a) => pick().upsertScan(a);
export const listUserScans = (a, b) => pick().listUserScans(a, b);
export const saveChatMessage = (a) => pick().saveChatMessage(a);
export const listChatMessages = (a, b) => pick().listChatMessages(a, b);