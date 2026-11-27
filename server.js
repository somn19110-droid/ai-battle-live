
const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

// Alle vijf modellen zijn gratis OpenRouter-modellen.
const providers = [
  {
    name: "Nemotron 3 Ultra",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free"
  },
  {
    name: "ERNIE 5.5 Flash",
    model: "baidu/ernie-5.5-flash-preview:free"
  },
  {
    name: "Nemotron 3.5 Super VL",
    model: "nvidia/nemotron-3.5-super-vl:free"
  },
  {
    name: "Ling 3.2 Flash",
    model: "inclusionai/ling-3.2-flash:free"
  },
  {
    name: "Particle 1",
    model: "particle-ai/particle-1:free"
  }
];

async function askAI(provider, question) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return {
      name: provider.name,
      answer: "OpenRouter API-sleutel ontbreekt.",
      error: true
    };
  }

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ai-battle-live.onrender.com",
          "X-Title": "AI Battle Live"
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            {
              role: "user",
              content: question
            }
          ],
          max_tokens: 1200
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message || `API-fout ${response.status}`
      );
    }

    const answer = data.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error("Geen antwoord ontvangen.");
    }

    return {
      name: provider.name,
      answer: typeof answer === "string"
        ? answer
        : answer.map(part => part.text || "").join(""),
      error: false
    };

  } catch (error) {
    return {
      name: provider.name,
      answer: error.name === "TimeoutError"
        ? "Het model reageerde niet op tijd."
        : error.message,
      error: true
    };
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    apiKeyConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    models: providers.map(provider => provider.name)
  });
});

app.post("/api/battle", async (req, res) => {
  const question = req.body?.question;

  if (typeof question !== "string" || !question.trim()) {
    return res.status(400).json({
      error: "Typ eerst een vraag."
    });
  }

  if (question.length > 4000) {
    return res.status(400).json({
      error: "Je vraag mag maximaal 4000 tekens bevatten."
    });
  }

  const results = await Promise.all(
    providers.map(provider =>
      askAI(provider, question.trim())
    )
  );

  res.json({ results });
});

app.listen(PORT, () => {
  console.log(`AI Battle draait op poort ${PORT}`);
});
