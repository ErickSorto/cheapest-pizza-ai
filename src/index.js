require("dotenv").config({ path: ".env.local", override: true });
const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const pizzaRoutes = require("./routes/pizza");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Cache the DB connection across serverless invocations
let dbPromise = null;
function getDB() {
  if (!dbPromise) {
    dbPromise = mongoose.connect(process.env.MONGODB_URI);
  }
  return dbPromise;
}

// Ensure DB is connected before every API call
app.use("/api", async (req, res, next) => {
  try {
    await getDB();
    next();
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

app.use("/api/pizza", pizzaRoutes);

// Local dev: start a real server
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  getDB()
    .then(() => {
      console.log("Connected to MongoDB");
      app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err);
      process.exit(1);
    });
}

module.exports = app;
