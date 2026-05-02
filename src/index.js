require("dotenv").config({ path: ".env.local", override: true });
const express = require("express");
const cors = require("cors");
const path = require("path");
const pizzaRoutes = require("./routes/pizza");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/pizza", pizzaRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
