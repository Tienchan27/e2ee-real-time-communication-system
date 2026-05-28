import http from "node:http";

const port = Number(process.env.PORT || 3000);

function sendJson(res, statusCode, data) {
  // Ham nho giup tra ve JSON giong nhau cho tat ca endpoint.
  const body = JSON.stringify(data);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Healthcheck de Docker/Nginx biet API service dang song.
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      status: "ok",
      service: "api-service",
    });
    return;
  }

  // Readycheck dung de kiem tra service da san sang nhan request hay chua.
  if (req.method === "GET" && url.pathname === "/ready") {
    sendJson(res, 200, {
      status: "ready",
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    });
    return;
  }

  // Endpoint mau di qua gateway: http://localhost/api/v1/health
  if (req.method === "GET" && url.pathname === "/api/v1/health") {
    sendJson(res, 200, {
      status: "ok",
      message: "API gateway route is working",
    });
    return;
  }

  sendJson(res, 404, {
    error: "Not Found",
    path: url.pathname,
  });
});

server.listen(port, "0.0.0.0", () => {
  // Log nay giup ban biet service da lang nghe dung port trong container.
  console.log(`api-service listening on port ${port}`);
});
