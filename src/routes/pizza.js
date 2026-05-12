const express = require("express");
const OpenAI = require("openai");

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/search", async (req, res) => {
  const { location, radius } = req.body;

  if (!location || !radius) {
    return res.status(400).json({ error: "location and radius are required" });
  }

  const prompt = `You are a pizza deal finder with live web search access.

Task: Find the cheapest pizza options within ${radius} miles of ${location}.

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
      model: "gpt-5.5",
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
