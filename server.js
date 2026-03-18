const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

app.get('/', (req, res) => {
  res.json({ status: '✅ Aultron AI Backend running!', version: '3.2' });
});

// CLAUDE
app.post('/api/claude', async (req, res) => {
  const { messages, system } = req.body;
  if (!messages) return res.status(400).json({ error: 'No messages' });
  const KEY = process.env.CLAUDE_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'Claude key not set' });
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 1024, stream: true,
        system: system || 'You are Aultron AI, a powerful intelligent assistant.',
        messages
      })
    });
    if (!upstream.ok) { const err = await upstream.json(); return res.status(upstream.status).json({ error: err.error?.message }); }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    upstream.body.pipe(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GPT-4o
app.post('/api/gpt', async (req, res) => {
  const { messages, system } = req.body;
  if (!messages) return res.status(400).json({ error: 'No messages' });
  const KEY = process.env.OPENAI_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'OpenAI key not set' });
  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o', stream: true,
        messages: [{ role: 'system', content: system || 'You are Aultron AI, a powerful intelligent assistant.' }, ...messages]
      })
    });
    if (!upstream.ok) { const err = await upstream.json(); return res.status(upstream.status).json({ error: err.error?.message }); }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    upstream.body.pipe(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GEMINI 1.0 PRO (free tier)
app.post('/api/gemini', async (req, res) => {
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: 'No messages' });
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'Gemini key not set' });

  try {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:streamGenerateContent?alt=sse&key=${KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: 1024 }
        })
      }
    );

    if (!upstream.ok) {
      const err = await upstream.json();
      return res.status(upstream.status).json({ error: err.error?.message || 'Gemini error' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let buffer = '';
    upstream.body.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
        } catch {}
      }
    });
    upstream.body.on('end', () => { res.write('data: [DONE]\n\n'); res.end(); });
    upstream.body.on('error', () => res.end());

  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Aultron Backend v3.2 on port ${PORT}`));
