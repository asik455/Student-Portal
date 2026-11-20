require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { createAuthRouter } = require("./auth");
const complaintsRouter = require("./routes/complaints");

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "20kb" }));
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});
app.use("/api/auth", createAuthRouter());
app.use("/api/complaints", complaintsRouter);
app.use((req, res) => res.status(404).json({ error: "Endpoint not found." }));
app.use((error, req, res, next) => {
  console.error(error.message);
  if (error.name === "ValidationError") return res.status(400).json({ error: error.message });
  if (error.code === 11000) return res.status(409).json({ error: "A complaint with this ID already exists. Please retry." });
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Request body must contain valid JSON." });
  }
  res.status(500).json({ error: "The request could not be completed. Please try again." });
});

async function start() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured in Backend/.env.");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB.");
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`Unable to start API: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { app, start };
