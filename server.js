const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

const defaultData = {
  users: [],
  transactions: [],
  kyc: [],
  settings: {
    otpLogin: true,
    registration: true,
    maintenance: false,
    minDeposit: 10,
    maxDeposit: 10000,
    minWithdraw: 100,
    maxWithdraw: 10000
  }
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
      return JSON.parse(JSON.stringify(defaultData));
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    data.users ||= [];
    data.transactions ||= [];
    data.kyc ||= [];

    data.settings = {
      ...defaultData.settings,
      ...(data.settings || {})
    };

    return data;

  } catch (err) {
    return JSON.parse(JSON.stringify(defaultData));
  }
}

function saveData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });

  res.end(JSON.stringify(data));
}

function getBody(req) {
  return new Promise((resolve, reject) => {

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {

      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }

    });

    req.on("error", reject);

  });
}

const server = http.createServer(async (req, res) => {

  if (req.method === "OPTIONS") {

    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });

    return res.end();
  }

  const url = new URL(
    req.url,
    `http://${req.headers.host}`
  );

  const data = loadData();

  try {

    /* =========================
       HEALTH
    ========================= */

    if (
      req.method === "GET" &&
      url.pathname === "/api/health"
    ) {

      return sendJSON(res, 200, {
        ok: true,
        service: "LudoKingStar backend demo"
      });

    }


    /* =========================
       GET SETTINGS
    ========================= */

    if (
      req.method === "GET" &&
      url.pathname === "/api/settings"
    ) {

      return sendJSON(
        res,
        200,
        data.settings
      );

    }


    /* =========================
       SAVE SETTINGS
    ========================= */

    if (
      req.method === "POST" &&
      url.pathname === "/api/admin/settings"
    ) {

      const body = await getBody(req);

      const booleanFields = [
        "otpLogin",
        "registration",
        "maintenance"
      ];

      const numberFields = [
        "minDeposit",
        "maxDeposit",
        "minWithdraw",
        "maxWithdraw"
      ];


      for (const field of booleanFields) {

        if (field in body) {

          data.settings[field] =
            Boolean(body[field]);

        }

      }


      for (const field of numberFields) {

        if (field in body) {

          const value =
            Number(body[field]);

          if (
            !Number.isFinite(value) ||
            value < 0
          ) {

            return sendJSON(res, 400, {
              error:
                `${field} must be a valid non-negative number`
            });

          }

          data.settings[field] =
            value;

        }

      }


      if (
        data.settings.minDeposit >
        data.settings.maxDeposit
      ) {

        return sendJSON(res, 400, {
          error:
            "Minimum deposit cannot be greater than maximum deposit"
        });

      }


      if (
        data.settings.minWithdraw >
        data.settings.maxWithdraw
      ) {

        return sendJSON(res, 400, {
          error:
            "Minimum withdraw cannot be greater than maximum withdraw"
        });

      }


      saveData(data);


      return sendJSON(res, 200, {
        ok: true,
        message: "Settings saved",
        settings: data.settings
      });

    }


    /* =========================
       REQUEST OTP
    ========================= */

    if (
      req.method === "POST" &&
      url.pathname === "/api/auth/request-otp"
    ) {

      if (data.settings.maintenance) {

        return sendJSON(res, 503, {
          error:
            "Maintenance mode is enabled"
        });

      }


      if (!data.settings.otpLogin) {

        return sendJSON(res, 403, {
          error:
            "OTP login is disabled"
        });

      }


      const body =
        await getBody(req);


      /*
        IMPORTANT:
        Accept both:
        mobile
        phone
      */

      const mobile =
        String(
          body.mobile ||
          body.phone ||
          ""
        ).trim();


      if (!mobile) {

        return sendJSON(res, 400, {
          error:
            "Phone number is required"
        });

      }


      let user =
        data.users.find(
          u =>
            String(
              u.mobile ||
              u.phone ||
              ""
            ) === mobile
        );


      if (!user) {

        if (!data.settings.registration) {

          return sendJSON(res, 403, {
            error:
              "Registration is disabled"
          });

        }


        user = {
          id: Date.now(),
          name:
            String(body.name || "Player"),
          mobile: mobile,
          phone: mobile,
          wallet: 0,
          verified: false,
          createdAt:
            new Date().toISOString()
        };


        data.users.push(user);

        saveData(data);

      }


      return sendJSON(res, 200, {
        ok: true,
        message: "Demo OTP sent",
        demoOtp: "123456"
      });

    }


    /* =========================
       VERIFY OTP
    ========================= */

    if (
      req.method === "POST" &&
      url.pathname === "/api/auth/verify-otp"
    ) {

      const body =
        await getBody(req);


      /*
        Accept both:
        mobile
        phone
      */

      const mobile =
        String(
          body.mobile ||
          body.phone ||
          ""
        ).trim();


      const otp =
        String(
          body.otp || ""
        ).trim();


      if (!mobile || !otp) {

        return sendJSON(res, 400, {
          error:
            "Phone and OTP are required"
        });

      }


      if (otp !== "123456") {

        return sendJSON(res, 401, {
          error:
            "Invalid demo OTP"
        });

      }


      const user =
        data.users.find(
          u =>
            String(
              u.mobile ||
              u.phone ||
              ""
            ) === mobile
        );


      if (!user) {

        return sendJSON(res, 404, {
          error:
            "User not found"
        });

      }


      user.mobile =
        user.mobile ||
        user.phone ||
        mobile;

      user.phone =
        user.phone ||
        user.mobile ||
        mobile;

      user.name =
        user.name ||
        "Player";

      user.wallet =
        Number(user.wallet || 0);

      user.verified = true;


      saveData(data);


      return sendJSON(res, 200, {
        ok: true,
        message: "OTP verified",

        user: {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          phone: user.phone,
          wallet: user.wallet,
          verified: user.verified,
          createdAt: user.createdAt || null
        }

      });

    }


    /* =========================
       USERS
    ========================= */

    if (
      req.method === "GET" &&
      url.pathname === "/api/users"
    ) {

      return sendJSON(
        res,
        200,
        data.users
      );

    }


    /* =========================
       TRANSACTIONS
    ========================= */

    if (
      req.method === "GET" &&
      url.pathname === "/api/transactions"
    ) {

      return sendJSON(
        res,
        200,
        data.transactions
      );

    }


    /* =========================
       KYC
    ========================= */

    if (
      req.method === "GET" &&
      url.pathname === "/api/kyc"
    ) {

      return sendJSON(
        res,
        200,
        data.kyc
      );

    }


    /* =========================
       ADMIN USER
    ========================= */

    if (
      req.method === "POST" &&
      url.pathname === "/api/admin/user"
    ) {

      const body =
        await getBody(req);


      const mobile =
        String(
          body.mobile ||
          body.phone ||
          ""
        ).trim();


      const user = {

        id: Date.now(),

        name:
          String(
            body.name ||
            "Player"
          ),

        mobile: mobile,

        phone: mobile,

        wallet:
          Number(
            body.wallet || 0
          ),

        verified:
          Boolean(
            body.verified
          ),

        createdAt:
          new Date().toISOString()

      };


      data.users.push(user);

      saveData(data);


      return sendJSON(res, 200, {
        ok: true,
        user
      });

    }


    /* =========================
       NOT FOUND
    ========================= */

    return sendJSON(res, 404, {
      error: "Route not found"
    });


  } catch (err) {

    console.error(err);

    return sendJSON(res, 500, {
      error:
        "Internal server error"
    });

  }

});


server.listen(PORT, () => {

  console.log(
    `LudoKingStar backend running on port ${PORT}`
  );

});
