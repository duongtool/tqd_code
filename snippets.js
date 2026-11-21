// api/snippets.js — Vercel Serverless Function (Node.js)
// GET    /api/snippets        -> trả về mảng snippet đã lưu, mới nhất trước
// POST   /api/snippets        -> body {name, code, lang} -> thêm 1 snippet
// DELETE /api/snippets?id=... -> xóa 1 snippet theo id
const { kv } = require('@vercel/kv');

const KEY = 'snippets';

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const items = (await kv.get(KEY)) || [];
      res.status(200).json(items);
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const name = String(body.name || '').slice(0, 200);
      const code = String(body.code || '').slice(0, 200000);
      const lang = String(body.lang || 'plain').slice(0, 40);
      if (!name || !code) {
        res.status(400).json({ error: 'missing name or code' });
        return;
      }
      const items = (await kv.get(KEY)) || [];
      const item = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name,
        code,
        lang,
        ts: Date.now(),
      };
      items.unshift(item);
      await kv.set(KEY, items);
      res.status(200).json(item);
      return;
    }

    if (req.method === 'DELETE') {
      const id = req.query && req.query.id;
      if (!id) {
        res.status(400).json({ error: 'missing id' });
        return;
      }
      const items = (await kv.get(KEY)) || [];
      const next = items.filter((it) => it.id !== id);
      await kv.set(KEY, next);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
