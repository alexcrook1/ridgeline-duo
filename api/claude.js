export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { text, images = [], system, jsonOnly = false } = req.body;
    const content = [];
    images.forEach((img) =>
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.type || "image/jpeg", data: img.data },
      })
    );
    content.push({ type: "text", text });

    const body = {
      model: "claude-sonnet-5",
      max_tokens: 1000,
      messages: [{ role: "user", content }],
    };
    if (system) body.system = system;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) {
      res.status(resp.status).json({ error: data });
      return;
    }
    const out = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (jsonOnly) {
      const clean = out.replace(/```json|```/g, "").trim();
      try {
        res.status(200).json({ result: JSON.parse(clean) });
        return;
      } catch {
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) {
          res.status(200).json({ result: JSON.parse(match[0]) });
          return;
        }
        res.status(200).json({ error: "Could not parse AI response", raw: out });
        return;
      }
    }
    res.status(200).json({ result: out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
