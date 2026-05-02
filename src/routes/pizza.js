const express = require("express");
const OpenAI = require("openai");

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/search", async (req, res) => {
  const { location, radius } = req.body;

  if (!location || !radius) {
    return res.status(400).json({ error: "location and radius are required" });
  }

  const prompt = `You are a pizza deal finder. Find the cheapest pizza options within ${radius} miles of ${location}.
Return ONLY valid JSON with this exact shape, no extra text:
{ "results": [ { "name": string, "address": string, "cheapestItem": string, "price": string, "note": string } ] }`;

  try {
    const response = await openai.responses.create({
      model: "gpt-5.5",
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
