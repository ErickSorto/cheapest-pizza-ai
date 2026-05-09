const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const router = express.Router();
// Uses ANTHROPIC_API_KEY from environment (set in .env.local)
const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post("/search", async (req, res) => {
  const { location, radius } = req.body;

  if (!location || !radius) {
    return res.status(400).json({ error: "location and radius are required" });
  }

  const prompt = `Search the web and find the cheapest pizza options available within ${radius} miles of ${location}.
Look up real pizza restaurants in that area and their current deals or menu prices.
Return ONLY valid JSON with this exact shape — no markdown, no extra text:
{ "results": [ { "name": string, "address": string, "cheapestItem": string, "price": string, "note": string } ] }
Include 3-6 results sorted from cheapest to most expensive. The "note" field should mention the deal type or any relevant info (e.g. "Lunch special", "Delivery only", etc.).`;

  try {
    // Use Claude with web_search so results are real and current
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    });

    // Extract the final text block from Claude's response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No text in Claude response");

    const raw = textBlock.text;
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
