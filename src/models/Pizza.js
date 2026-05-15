const mongoose = require("mongoose");

const pizzaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    size: { type: String, enum: ["Small", "Medium", "Large", "XL"], required: true },
    crust: { type: String, enum: ["Thin", "Hand-Tossed", "Thick", "Stuffed"], required: true },
    sauce: { type: String, enum: ["Marinara", "White", "BBQ", "Pesto"], required: true },
    orderType: { type: String, enum: ["Whole", "Slice"], default: "Whole" },
    toppings: [{ type: String }],
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pizza", pizzaSchema);
