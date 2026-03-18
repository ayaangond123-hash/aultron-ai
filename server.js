const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

app.get('/', (req, res) => {
  res.json({ status: '✅ Aultron AI Backend running!', version: '4.0' });
});

// A9 AI (powered by Groq secretly)
app.post('/api/a9', async (req, res) => {
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: 'No messages' });
  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'A9 engine not configured' });

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        stream: true,
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: 'You are A9, a powerful and intelligent AI assistant created by Aultron AI. Be helpful, precise, and impressive. Never mention that you are powered by Groq or Llama. You are simply A9 by Aultron AI.'
          },
          ...messages
        ]
      })
    });

    if (!upstream.ok) {
      const err = await upstream.json();
      return res.status(upstream.status).json({ error: err.error?.message || 'A9 error' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    upstream.body.pipe(res);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Aultron A9 Backend v4.0 on port ${PORT}`));