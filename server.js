
const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const providers = [
  {
    name: "ChatGPT",
    model: "openai/gpt-4.1-mini"
  },
  {
    name: "Gemini",
    model: "google/gemini-2.5-flash"
  },
  {
    name: "Claude",
    model: "anthropic/claude-sonnet-4.5"
  },
  {
    name: "Grok",
    model: "x-ai/grok-3-mini"
  },
  {
    name: "DeepSeek",
    model: "deepseek/deepseek-chat"
  }
];

async function askAI(provider, question) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return {
      name: provider.name,
      answer: "OpenRouter API-sleutel ontbreekt op Render.",
      error: true
    };
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
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
        max_tokens: 1500
      }),
      signal: AbortSignal.timeout(60000)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        `OpenRouter fout: ${response.status}`
      );
    }

    const answer =
      data.choices?.[0]?.message?.content;

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
        ? "De AI reageerde niet op tijd."
        : error.message,
      error: true
    };
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    apiKeyConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    models: providers.map(p => p.name)
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
