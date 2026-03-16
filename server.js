const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

// Firebase Admin
let firebaseReady = false;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  firebaseReady = true;
  console.log('✅ Firebase Admin ready');
} catch (e) {
  console.warn('⚠️ Firebase not configured:', e.message);
}

// Auth middleware
async function verifyToken(req, res, next) {
  if (!firebaseReady) return next();
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Health check
app.get('/', (req, res) => {
  res.json({ status: '✅ Aultron AI Backend running!', version: '2.0' });
});

// Claude streaming
app.post('/api/claude', verifyToken, async (req, res) => {
  const { messages, system } = req.body;
  if (!messages) return res.status(400).json({ error: 'No messages' });
  const KEY = process.env.CLAUDE_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'Claude key not set' });

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        stream: true,
        system: system || 'You are Aultron AI, a powerful intelligent assistant.',
        messages
      })
    });

    if (!upstream.ok) {
      const err = await upstream.json();
      return res.status(upstream.status).json({ error: err.error?.message });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    upstream.body.pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GPT-4o streaming
app.post('/api/gpt', verifyToken, async (req, res) => {
  const { messages, system } = req.body;
  if (!messages) return res.status(400).json({ error: 'No messages' });
  const KEY = process.env.OPENAI_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'OpenAI key not set' });

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        stream: true,
        messages: [
          { role: 'system', content: system || 'You are Aultron AI, a powerful intelligent assistant.' },
          ...messages
        ]
      })
    });

    if (!upstream.ok) {
      const err = await upstream.json();
      return res.status(upstream.status).json({ error: err.error?.message });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    upstream.body.pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Aultron Backend on port ${PORT}`));
