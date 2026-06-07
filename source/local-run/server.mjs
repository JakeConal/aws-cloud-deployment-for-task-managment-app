import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT || 3000);
const apiOrigin = "https://x8hr2ow73f.execute-api.ap-southeast-1.amazonaws.com";
const apiBasePath = "/prod";
const sourceIndexPath = path.resolve(__dirname, "..", "frontend", "index.html");

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function serveIndex(res) {
  const original = fs.readFileSync(sourceIndexPath, "utf8");
  const transformed = original.replace(
    'apiUrl: "https://x8hr2ow73f.execute-api.ap-southeast-1.amazonaws.com/prod"',
    'apiUrl: "/api"'
  );
  send(res, 200, transformed, "text/html; charset=utf-8");
}

function proxyApi(req, res) {
  const apiPath = req.url.replace(/^\/api/, "") || "/";
  const target = new URL(`${apiOrigin}${apiBasePath}${apiPath}`);

  const headers = { ...req.headers };
  headers.host = target.host;
  delete headers.origin;
  delete headers.referer;
  delete headers["content-length"];

  const proxyReq = https.request(
    target,
    {
      method: req.method,
      headers
    },
    (proxyRes) => {
      const responseHeaders = { ...proxyRes.headers };
      delete responseHeaders["access-control-allow-origin"];
      delete responseHeaders["access-control-allow-headers"];
      delete responseHeaders["access-control-allow-methods"];
      responseHeaders["access-control-allow-origin"] = `http://localhost:${port}`;
      responseHeaders["access-control-allow-headers"] = "Content-Type,Authorization";
      responseHeaders["access-control-allow-methods"] = "GET,POST,PUT,DELETE,OPTIONS";

      res.writeHead(proxyRes.statusCode || 502, responseHeaders);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (error) => {
    send(res, 502, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    return send(res, 400, "Bad request");
  }

  if (req.method === "OPTIONS" && req.url.startsWith("/api")) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": `http://localhost:${port}`,
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
    });
    return res.end();
  }

  if (req.url === "/" || req.url === "/index.html") {
    return serveIndex(res);
  }

  if (req.url.startsWith("/api")) {
    return proxyApi(req, res);
  }

  return send(res, 404, "Not found");
});

server.listen(port, () => {
  console.log(`Local app: http://localhost:${port}`);
  console.log(`Proxy target: ${apiOrigin}${apiBasePath}`);
  console.log(`Source index: ${sourceIndexPath}`);
});
