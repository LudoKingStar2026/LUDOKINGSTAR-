const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "data.json");

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      users: [],
      transactions: [],
      kyc: [],
      settings: {
        otpLogin: true,
        registration: true,
        maintenance: false
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", chunk => raw += chunk);

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const db = loadDB();

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, {
        ok: true,
        service: "LudoKingStar backend demo"
      });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/request-otp") {
      const body = await readBody(req);
      const mobile = String(body.mobile || "").replace(/\D/g, "");

      if (!/^\d{10}$/.test(mobile)) {
        return send(res, 400, {
          error: "Enter a valid 10-digit mobile number"
        });
      }

      let user = db.users.find(u => u.mobile === mobile);

      if (!user && db.settings.registration) {
        user = {
          id: "u_" + Date.now(),
          name: body.name || "Player",
          mobile,
          wallet: 0,
          verified: false,
          createdAt: new Date().toISOString()
        };

        db.users.push(user);
        saveDB(db);
      }

      return send(res, 200, {
        ok: true,
        message: "Demo OTP generated",
        demoOtp: "123456",
        mobile
      });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/verify-otp") {
      const body = await readBody(req);
      const mobile = String(body.mobile || "").replace(/\D/g, "");

      if (body.otp !== "123456") {
        return send(res, 401, {
          error: "Invalid OTP (demo OTP is 123456)"
        });
      }

      const user = db.users.find(u => u.mobile === mobile);

      if (!user) {
        return send(res, 404, {
          error: "User not found"
        });
      }

      user.verified = true;
      saveDB(db);

      return send(res, 200, {
        ok: true,
        user
      });
    }

    if (req.method === "GET" && url.pathname === "/api/users") {
      return send(res, 200, {
        users: db.users
      });
    }

    if (req.method === "GET" && url.pathname === "/api/transactions") {
      return send(res, 200, {
        transactions: db.transactions
      });
    }

    if (req.method === "GET" && url.pathname === "/api/kyc") {
      return send(res, 200, {
        kyc: db.kyc
      });
    }

    if (req.method === "GET" && url.pathname === "/api/settings") {
      return send(res, 200, {
        settings: db.settings
      });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/user") {
      const body = await readBody(req);

      if (!body.name || !body.mobile) {
        return send(res, 400, {
          error: "name and mobile required"
        });
      }

      const mobile = String(body.mobile).replace(/\D/g, "");

      if (db.users.some(u => u.mobile === mobile)) {
        return send(res, 409, {
          error: "User already exists"
        });
      }

      const user = {
        id: "u_" + Date.now(),
        name: body.name,
        mobile,
        wallet: Number(body.wallet || 0),
        verified: false,
        createdAt: new Date().toISOString()
      };

      db.users.push(user);
      saveDB(db);

      return send(res, 201, {
        ok: true,
        user
      });
    }

    return send(res, 404, {
      error: "Route not found"
    });

  } catch {
    return send(res, 500, {
      error: "Server error"
    });
  }
});

server.listen(PORT, () => {
  console.log(
    `LudoKingStar backend running at http://localhost:${PORT}`
  );
});
