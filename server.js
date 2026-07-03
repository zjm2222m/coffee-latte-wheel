const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
const SLOT_DATA_PATH = path.join(DATA_DIR, "slots.json");
const SLOT_COUNT = 8;
const MAX_BODY_BYTES = 8 * 1024 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp"
};

const mimeExtensions = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg"
};

const defaultSlotNames = ["天鹅拉花", "爱心拉花", "郁金香拉花", "树叶拉花", "小熊拉花", "玫瑰拉花", "海马拉花", "蝴蝶拉花"];

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", chunk => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Expected an image dataUrl in base64 format.");
  const mime = match[1].toLowerCase();
  const ext = mimeExtensions[mime];
  if (!ext) throw new Error("Only PNG, JPG, WEBP, and SVG uploads are supported.");
  return { mime, ext, buffer: Buffer.from(match[2].replace(/\s/g, ""), "base64") };
}

function readSlotNames() {
  try {
    const data = JSON.parse(fs.readFileSync(SLOT_DATA_PATH, "utf8"));
    if (Array.isArray(data.names)) return defaultSlotNames.map((name, index) => String(data.names[index] || name).slice(0, 20));
  } catch (error) {
    return defaultSlotNames;
  }
  return defaultSlotNames;
}

function writeSlotName(id, name) {
  const names = readSlotNames();
  names[id - 1] = String(name || "").trim().slice(0, 20) || defaultSlotNames[id - 1];
  fs.writeFileSync(SLOT_DATA_PATH, JSON.stringify({ names }, null, 2));
  return names[id - 1];
}

function getSlots() {
  const uploads = new Map();
  const names = readSlotNames();
  for (const filename of fs.readdirSync(UPLOAD_DIR)) {
    const match = /^slot-(\d+)\.(png|jpg|jpeg|webp|svg)$/.exec(filename);
    if (match) {
      const filePath = path.join(UPLOAD_DIR, filename);
      const version = Math.round(fs.statSync(filePath).mtimeMs);
      uploads.set(Number(match[1]), `/uploads/${filename}?v=${version}`);
    }
  }
  return Array.from({ length: SLOT_COUNT }, (_, index) => {
    const id = index + 1;
    return { id, name: names[index], imageUrl: uploads.get(id) || null, uploadKey: `slot_${id}_image` };
  });
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    res.writeHead(200, { "content-type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/slots") {
    sendJson(res, 200, { slots: getSlots(), upload: { method: "POST", path: "/api/slots/:id/image", body: { key: "slot_<id>_image", dataUrl: "data:image/png;base64,..." } }, rename: { method: "PATCH", path: "/api/slots/:id", body: { name: "咖啡拉花名称" } } });
    return;
  }
  const slotMatch = /^\/api\/slots\/(\d+)$/.exec(pathname);
  if (req.method === "PATCH" && slotMatch) {
    const id = Number(slotMatch[1]);
    if (!Number.isInteger(id) || id < 1 || id > SLOT_COUNT) return sendJson(res, 400, { error: "Slot id must be between 1 and 8." });
    try {
      const body = JSON.parse(await readBody(req));
      sendJson(res, 200, { slot: id, name: writeSlotName(id, body.name) });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }
  const uploadMatch = /^\/api\/slots\/(\d+)\/image$/.exec(pathname);
  if (req.method === "POST" && uploadMatch) {
    const id = Number(uploadMatch[1]);
    if (!Number.isInteger(id) || id < 1 || id > SLOT_COUNT) return sendJson(res, 400, { error: "Slot id must be between 1 and 8." });
    try {
      const body = JSON.parse(await readBody(req));
      const expectedKey = `slot_${id}_image`;
      if (body.key && body.key !== expectedKey) return sendJson(res, 400, { error: `Upload key must be ${expectedKey}.` });
      const image = parseDataUrl(body.dataUrl);
      for (const ext of ["png", "jpg", "jpeg", "webp", "svg"]) {
        const oldPath = path.join(UPLOAD_DIR, `slot-${id}.${ext}`);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      const filename = `slot-${id}.${image.ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), image.buffer);
      sendJson(res, 200, { slot: id, uploadKey: expectedKey, imageUrl: `/uploads/${filename}?v=${Date.now()}` });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }
  sendJson(res, 404, { error: "Unknown API route" });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url.pathname);
    return;
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Coffee wheel running at http://${HOST}:${PORT}`);
});
