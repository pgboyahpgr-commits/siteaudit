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

await registerRoutes(app);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ error: { code: "INTERNAL", message: err.message || "Internal error" } });
});

app.listen(PORT, HOST, () => console.log(`[siteaudit] API listening on http://localhost:${PORT}`));
