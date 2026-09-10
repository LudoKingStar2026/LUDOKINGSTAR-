const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/") {
    res.end(JSON.stringify({
      success: true,
      message: "LudoKingStar Demo Server is running"
    }));
    return;
  }

  if (req.url === "/api/health") {
    res.end(JSON.stringify({
      success: true,
      status: "online"
    }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({
    success: false,
    message: "Page not found"
  }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
