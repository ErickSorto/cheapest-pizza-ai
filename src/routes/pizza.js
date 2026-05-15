const express = require("express");
const OpenAI = require("openai");
const Pizza = require("../models/Pizza");

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VALID_SIZES = ["Small", "Medium", "Large", "XL"];
const VALID_CRUSTS = ["Thin", "Hand-Tossed", "Thick", "Stuffed"];
const VALID_SAUCES = ["Marinara", "White", "BBQ", "Pesto"];
const VALID_ORDER_TYPES = ["Whole", "Slice"];
const VALID_TOPPINGS = ["Pepperoni","Sausage","Mushrooms","Onions","Bell Peppers","Black Olives","Jalapeños","Bacon","Chicken","Pineapple","Spinach","Extra Cheese"];

router.post("/create", async (req, res) => {
  const { name, size, crust, sauce, toppings, notes, orderType } = req.body;
  if (!name || !size || !crust || !sauce) {
    return res.status(400).json({ error: "name, size, crust, and sauce are required" });
  }
  try {
    const pizza = await Pizza.create({
      name,
      size,
      crust,
      sauce,
      orderType: orderType || "Whole",
      toppings: toppings || [],
      notes: notes || "",
    });
    res.status(201).json(pizza);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save pizza" });
  }
});

router.get("/list", async (req, res) => {
  try {
    const pizzas = await Pizza.find().sort({ createdAt: -1 }).limit(50);
    res.json(pizzas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pizzas" });
  }
});

router.put("/:id", async (req, res) => {
  const { name, size, crust, sauce, toppings, notes, orderType } = req.body;
  if (!name || !size || !crust || !sauce) {
    return res.status(400).json({ error: "name, size, crust, and sauce are required" });
  }
  try {
    const pizza = await Pizza.findByIdAndUpdate(
      req.params.id,
      { name, size, crust, sauce, orderType: orderType || "Whole", toppings: toppings || [], notes: notes || "" },
      { new: true, runValidators: true }
    );
    if (!pizza) return res.status(404).json({ error: "Pizza not found" });
    res.json(pizza);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update pizza" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Pizza.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete pizza" });
  }
});

router.post("/ai-suggest", async (req, res) => {
  const prompt = `You are a creative pizza chef. Invent a unique, delicious-sounding pizza.
Return ONLY valid JSON with this exact shape, no extra text:
{
  "name": "Creative pizza name (max 5 words)",
  "size": "Large",
  "crust": "Hand-Tossed",
  "sauce": "Marinara",
  "orderType": "Whole",
  "toppings": ["Pepperoni", "Mushrooms"],
  "notes": "optional short note"
}
Allowed sizes: ${VALID_SIZES.join(", ")}
Allowed crusts: ${VALID_CRUSTS.join(", ")}
Allowed sauces: ${VALID_SAUCES.join(", ")}
Allowed orderTypes: ${VALID_ORDER_TYPES.join(", ")}
Allowed toppings (pick 2-5): ${VALID_TOPPINGS.join(", ")}
Be creative and vary your choices each time.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 1.1,
    });
    const raw = completion.choices[0].message.content;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const data = JSON.parse(jsonMatch[0]);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI suggestion failed" });
  }
});

router.post("/ai-name", async (req, res) => {
  const { size, crust, sauce, toppings, orderType } = req.body;
  const prompt = `You are a creative pizza chef. Generate a short, fun, catchy pizza name (2-5 words) for this pizza:
- Size: ${size || "Large"}
- Crust: ${crust || "Hand-Tossed"}
- Sauce: ${sauce || "Marinara"}
- Order type: ${orderType || "Whole"}
- Toppings: ${toppings && toppings.length ? toppings.join(", ") : "plain cheese"}
Return ONLY the pizza name, nothing else. No quotes.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 1.0,
    });
    const name = completion.choices[0].message.content.trim().replace(/^["']|["']$/g, "");
    res.json({ name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI naming failed" });
  }
});

router.post("/search", async (req, res) => {
  const { location, radius, pizza, restaurantType } = req.body;
  if (!location || !radius) {
    return res.status(400).json({ error: "location and radius are required" });
  }

  // Build order-type hard filter — this must be prominent so the AI treats it as a strict rule
  const isSlice = pizza?.orderType === "Slice";
  const orderTypeFilter = isSlice
    ? `\n\nCRITICAL — ORDER TYPE FILTER: The user wants pizza BY THE SLICE only. You MUST only return restaurants that actually sell individual pizza slices (e.g. pizzerias with a slice counter, shops that sell by-the-slice, or restaurants with a "slices" menu item). Do NOT return any result where the cheapest option is a whole pizza. If you cannot confirm a restaurant sells slices, exclude it entirely.`
    : `\n\nORDER TYPE: The user wants a whole pizza (not by the slice). Focus on whole-pizza deals and meal deals.`;

  let pizzaContext = "";
  if (pizza) {
    const toppingStr = pizza.toppings?.length ? `, topped with ${pizza.toppings.join(", ")}` : "";
    const sizeStr = isSlice ? "" : ` ${pizza.size}`;
    pizzaContext = `\n\nTarget pizza: "${pizza.name}" —${sizeStr} ${pizza.crust} crust, ${pizza.sauce} sauce${toppingStr}. Prioritize restaurants whose menu most closely matches this style. The cheapestItem in your response should be the closest matching item.`;
  }

  let typeFilter = "";
  if (restaurantType === "Chains") {
    typeFilter = "\n\nRESTAURANT TYPE FILTER: Only include well-known national or regional pizza chains (e.g. Domino's, Pizza Hut, Papa John's, Little Caesars, Papa Murphy's, Marco's, Hungry Howie's). Do NOT include independent or local restaurants.";
  } else if (restaurantType === "Local") {
    typeFilter = "\n\nRESTAURANT TYPE FILTER: Only include independent, locally-owned pizza restaurants. Do NOT include national chains like Domino's, Pizza Hut, Papa John's, or Little Caesars.";
  }

  const prompt = `You are a pizza deal finder with live web search access.

Task: Find the cheapest pizza options within ${radius} miles of ${location}.${orderTypeFilter}${pizzaContext}${typeFilter}

Instructions:
1. Use web search to find real, currently operating pizza restaurants in that area.
2. For each result, search for their online ordering page — do NOT guess or construct URLs.
3. The orderUrl must be the exact page where the user can add that item to their cart. Requirements:
   - For chains (Domino's, Pizza Hut, Papa John's, Little Caesars, etc.): search for their store locator, select the nearest store, and use the resulting menu URL for that specific location.
   - For local/independent restaurants: find their own online ordering page or their listing on DoorDash, Uber Eats, or Slice — link directly to that restaurant's page on the platform.
   - NEVER link to a homepage, a store search page, or any URL that requires the user to enter their address again.
   - NEVER fabricate or guess a URL — only use URLs you have confirmed exist via search.
4. Only include a result if you can find a working, specific orderUrl for it.

Return ONLY valid JSON with this exact shape, no extra text:
{ "results": [ { "name": string, "address": string, "cheapestItem": string, "price": string, "note": string, "orderUrl": string } ] }`;

  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      tools: [{ type: "web_search_preview" }],
      input: prompt,
    });
    const raw = response.output_text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const data = JSON.parse(jsonMatch[0]);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pizza deals" });
  }
});

module.exports = router;
