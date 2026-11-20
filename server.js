// server.js — backend thật cho Tqd: lưu code vào file JSON trên server (không phải localStorage)
// Chạy: npm install && npm start  → mở http://localhost:3000
"use strict";
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "snippets.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ---------- Lưu trữ: đọc/ghi file JSON (đơn giản, không cần cài database) ---------- */
function readSnippets() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
function writeSnippets(list) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
}

/* ---------- API ---------- */
// Lấy tất cả code đã lưu, mới nhất trước
app.get("/api/snippets", (req, res) => {
  const list = readSnippets().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  res.json(list);
});

// Lưu một đoạn code mới
app.post("/api/snippets", (req, res) => {
  const { name, code, langName, langKey } = req.body || {};
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Thiếu tên code." });
  }
  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "Thiếu nội dung code." });
  }
  const item = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 200),
    code: code.slice(0, 200000),
    langName: typeof langName === "string" ? langName.slice(0, 60) : "",
    langKey: typeof langKey === "string" ? langKey.slice(0, 30) : "",
    ts: Date.now(),
  };
  const list = readSnippets();
  list.push(item);
  writeSnippets(list);
  res.status(201).json(item);
});

// Xóa một đoạn code theo id
app.delete("/api/snippets/:id", (req, res) => {
  const list = readSnippets();
  const next = list.filter((it) => it.id !== req.params.id);
  if (next.length === list.length) return res.status(404).json({ error: "Không tìm thấy." });
  writeSnippets(next);
  res.json({ ok: true });
});

// Xóa tất cả
app.delete("/api/snippets", (req, res) => {
  writeSnippets([]);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Tqd backend đang chạy tại http://localhost:${PORT}`);
  console.log(`Dữ liệu được lưu tại ${DATA_FILE}`);
});
