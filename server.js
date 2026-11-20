
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================
// CONFIG
// =====================================

// Frontend Vercel được phép truy cập API.
// Có thể thêm nhiều domain trong biến ALLOWED_ORIGINS trên Render.
const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ||
    "https://tqd-code.vercel.app,http://localhost:3000"
)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

// Giữ file snippets.json ở thư mục gốc dự án
const DATA_FILE = path.join(__dirname, "snippets.json");

// =====================================
// MIDDLEWARE
// =====================================

app.use(cors({
    origin: function (origin, callback) {
        // Cho phép request không có Origin (ví dụ curl hoặc server-to-server).
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origin không được phép truy cập API"));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "2mb" }));

// =====================================
// DATA FUNCTIONS
// =====================================

function ensureDataFile() {
    const folder = path.dirname(DATA_FILE);

    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, "[]", "utf8");
    }
}

function readSnippets() {
    ensureDataFile();

    try {
        const content = fs.readFileSync(DATA_FILE, "utf8");
        const data = JSON.parse(content || "[]");

        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Lỗi đọc dữ liệu:", error);
        throw new Error("Không thể đọc dữ liệu snippets");
    }
}

// Ghi dữ liệu theo file tạm rồi thay thế file chính
function writeSnippets(data) {
    ensureDataFile();

    const tempFile = DATA_FILE + ".tmp";

    fs.writeFileSync(
        tempFile,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    fs.renameSync(tempFile, DATA_FILE);
}

// Tránh các thao tác ghi file đồng thời gây mất dữ liệu
let writeQueue = Promise.resolve();

function queueWrite(data) {
    const task = writeQueue.then(() => writeSnippets(data));

    writeQueue = task.catch(error => {
        console.error("Lỗi ghi dữ liệu:", error);
    });

    return task;
}

// =====================================
// HEALTH CHECK
// =====================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "TQD Code Vault API is running",
        version: "1.0.0"
    });
});

app.get("/health", (req, res) => {
    res.json({
        success: true,
        status: "online"
    });
});

// =====================================
// GET ALL SNIPPETS
// =====================================

app.get("/api/snippets", (req, res) => {
    try {
        const snippets = readSnippets();

        res.json(snippets);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách snippets"
        });
    }
});

// =====================================
// ADD SNIPPET
// =====================================

app.post("/api/snippets", async (req, res) => {
    try {
        const body = req.body;

        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return res.status(400).json({
                success: false,
                message: "Dữ liệu không hợp lệ"
            });
        }

        // Hỗ trợ cả dạng gửi trực tiếp và dạng { snippet: {...} }
        const input = body.snippet || body;

        if (
            !input ||
            typeof input !== "object" ||
            Array.isArray(input)
        ) {
            return res.status(400).json({
                success: false,
                message: "Snippet không hợp lệ"
            });
        }

        const snippets = readSnippets();

        const newSnippet = {
            ...input,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString()
        };

        snippets.unshift(newSnippet);

        await queueWrite(snippets);

        res.status(201).json({
            success: true,
            message: "Đã lưu snippet",
            snippet: newSnippet
        });

    } catch (error) {
        console.error("Lỗi thêm snippet:", error);

        res.status(500).json({
            success: false,
            message: "Không thể lưu snippet"
        });
    }
});

// =====================================
// DELETE ONE SNIPPET
// =====================================

app.delete("/api/snippets/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const snippets = readSnippets();

        const index = snippets.findIndex(
            item => String(item.id) === String(id)
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy snippet"
            });
        }

        const deleted = snippets.splice(index, 1)[0];

        await queueWrite(snippets);

        res.json({
            success: true,
            message: "Đã xóa snippet",
            snippet: deleted
        });

    } catch (error) {
        console.error("Lỗi xóa snippet:", error);

        res.status(500).json({
            success: false,
            message: "Không thể xóa snippet"
        });
    }
});

// =====================================
// DELETE ALL SNIPPETS
// =====================================

app.delete("/api/snippets", async (req, res) => {
    try {
        await queueWrite([]);

        res.json({
            success: true,
            message: "Đã xóa toàn bộ snippets"
        });

    } catch (error) {
        console.error("Lỗi xóa dữ liệu:", error);

        res.status(500).json({
            success: false,
            message: "Không thể xóa dữ liệu"
        });
    }
});

// =====================================
// ERROR HANDLER
// =====================================

app.use((err, req, res, next) => {
    console.error("Server error:", err.message);

    if (err.message.includes("Origin")) {
        return res.status(403).json({
            success: false,
            message: "Origin không được phép truy cập"
        });
    }

    res.status(500).json({
        success: false,
        message: "Lỗi máy chủ"
    });
});

// =====================================
// START SERVER
// =====================================

ensureDataFile();

app.listen(PORT, "0.0.0.0", () => {
    console.log("--------------------------------");
    console.log(" TQD CODE VAULT API");
    console.log("--------------------------------");
    console.log("Status: ONLINE");
    console.log("Port:", PORT);
    console.log("Data:", DATA_FILE);
    console.log("Allowed origins:", allowedOrigins);
    console.log("--------------------------------");
});
