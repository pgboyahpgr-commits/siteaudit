import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes.js";

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
  })
);

// Parse x-sa-settings header from frontend (user-configured API keys)
app.use((req, res, next) => {
  try {
    const headerVal = req.headers["x-sa-settings"];
    if (headerVal) {
      const decoded = JSON.parse(Buffer.from(headerVal, "base64").toString("utf8"));
      if (decoded && typeof decoded === "object") {
        globalThis.__saUserSettings = { ...(globalThis.__saUserSettings || {}), ...decoded };
      }
    }
  } catch {
    /* header parse failed, ignore */
  }
  next();
});

await registerRoutes(app);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ error: { code: "INTERNAL", message: err.message || "Internal error" } });
});

app.listen(PORT, HOST, () => console.log(`[siteaudit] API listening on http://localhost:${PORT}`));
