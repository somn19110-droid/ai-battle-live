const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

const providers = [
  {
    name: "ChatGPT",
    key: "OPENAI_API_KEY",
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    url: "https://api.openai.com/v1/chat/completions",
    type: "openai"
  },
  {
    name: "Gemini",
    key: "GEMINI_API_KEY",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    url: "https://generativelanguage.googleapis.com/v1beta/models/",
    type: "gemini"
  },
  {
    name: "Claude",
    key: "ANTHROPIC_API_KEY",
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
    url: "https://api.anthropic.com/v1/messages",
    type: "claude"
  },
  {
    name: "Grok",
    key: "XAI_API_KEY",
    model: process.env.GROK_MODEL || "grok-3-mini",
    url: "https://api.x.ai/v1/chat/completions",
    type: "openai"
  },
  {
    name: "DeepSeek",
    key: "DEEPSEEK_API_KEY",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    url: "https://api.deepseek.com/chat/completions",
    type: "openai"
  }
];

async function askAI(provider, question) {
  const apiKey = process.env[provider.key];

  if (!apiKey) {
    return {
      name: provider.name,
      answer: "Nog niet verbonden. De API-sleutel ontbreekt.",
      error: true
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    let url = provider.url;
    let headers = {
      "Content-Type": "application/json"
    };
    let body;

    if (provider.type === "gemini") {
      url += `${provider.model}:generateContent?key=${apiKey}`;
      body = {
        contents: [{ parts: [{ text: question }] }]
      };
    } else if (provider.type === "claude") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      body = {
        model: provider.model,
        max_tokens: 1500,
        messages: [{ role: "user", content: question }]
      };
    } else {
      headers.Authorization = `Bearer ${apiKey}`;
      body = {
        model: provider.model,
        messages: [{ role: "user", content: question }]
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        data.message ||
        `API-fout (${response.status})`
      );
    }

    let answer = "";

    if (provider.type === "gemini") {
      answer =
        data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("") || "Geen antwoord ontvangen.";
    } else if (provider.type === "claude") {
      answer =
        data.content?.map(part => part.text || "").join("") ||
        "Geen antwoord ontvangen.";
    } else {
      answer =
        data.choices?.[0]?.message?.content ||
        "Geen antwoord ontvangen.";
    }

    return {
      name: provider.name,
      answer,
      error: false
    };
  } catch (error) {
    return {
      name: provider.name,
      answer: error.name === "AbortError"
        ? "De AI reageerde niet op tijd."
        : error.message,
      error: true
    };
  } finally {
    clearTimeout(timeout);
  }
}

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
