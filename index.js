const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const path = require("path");
const kv = require("./structs/backend.js");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());
const WebSocket = require("ws");
const https = require("https");

const log = require("./structs/log.js");
const error = require("./structs/error.js");
const functions = require("./structs/functions.js");
const AutoBackendRestart = require("./structs/backend.js");

const app = express();

app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync("./ClientSettings")) fs.mkdirSync("./ClientSettings");

const PORT = config.port;
global.JWT_SECRET = functions.MakeID();

let httpsServer;
global.JWT_SECRET = functions.MakeID();

console.log("Welcome to Shyro Backend\n");

const tokens = JSON.parse(fs.readFileSync("./token/tokens.json").toString());

for (let tokenType in tokens) {
    for (let tokenIndex in tokens[tokenType]) {
        let decodedToken = jwt.decode(tokens[tokenType][tokenIndex].token.replace("eg1~", ""));

        if (DateAddHours(new Date(decodedToken.creation_date), decodedToken.hours_expire).getTime() <= new Date().getTime()) {
            tokens[tokenType].splice(Number(tokenIndex), 1);
        }
    }
}

fs.writeFileSync("./token/tokens.json", JSON.stringify(tokens, null, 2));

global.accessTokens = tokens.accessTokens;
global.refreshTokens = tokens.refreshTokens;
global.clientTokens = tokens.clientTokens;
global.kv = kv;

global.exchangeCodes = [];

mongoose.set("strictQuery", true);

mongoose.connect(config.mongodb.database, () => {
  log.backend("App successfully connected to MongoDB!");
});

mongoose.connection.on("error", (err) => {
  log.error(
    "MongoDB failed to connect, please make sure you have MongoDB installed and running.",
  );
  throw err;
});

app.use(rateLimit({ windowMs: 0.5 * 60 * 1000, max: 55 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

fs.readdirSync("./routes").forEach((fileName) => {
  try {
    app.use(require(`./routes/${fileName}`));
  } catch (err) {
    log.error(`Routes Error: Failed to load ${fileName}`);
  }
});

app.get("/unknown", (req, res) => {
  log.debug("GET /unknown endpoint called");
  res.json({ msg: "Shyro Backend - Made by Shyro, credits to Burlone" });
});

app.get('/server-status/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
        <html>
        <head><title>Server Status</title></head>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #000000;
                color: #ffffff;
                margin-left: 400px;
                padding: 40px;
                width: 100%;
                justify-content: center;
                align-items: center;
                }
        </style>
        <body>
            <h1>Servers Online</h1>
            <p>Shyro servers are online actually</p>
        </html>
    `);
});


let server;
server = app
  .listen(PORT, () => {
    log.backend(`Backend started listening on port ${PORT}`);
    require("./xmpp.js");
    if (config.discord.bUseDiscordBot === true) {
      require("./bot");
    }
    if (config.bUseAutoRotate === true) {
      require("./structs/backend.js");
    }
  })
  .on("error", async (err) => {
    if (err.code === "EADDRINUSE") {
      log.error(`Port ${PORT} is already in use!\nClosing in 3 seconds...`);
      await functions.sleep(3000);
      process.exit(0);
    } else {
      throw err;
    }
  });

if (config.bEnableAutoBackendRestart === true) {
  AutoBackendRestart.scheduleRestart(config.bRestartTime);
}

if (config.bEnableCalderaService === true) {
  const createCalderaService = require("./CalderaService/calderaservice");
  const calderaService = createCalderaService();

  if (!config.bGameVersion) {
    log.calderaservice("Please define a version in the config!");
    return;
  }

  calderaService
    .listen(config.bCalderaServicePort, () => {
      log.calderaservice(
        `Caldera Service started listening on port ${config.bCalderaServicePort}`,
      );
    })
    .on("error", async (err) => {
      if (err.code === "EADDRINUSE") {
        log.calderaservice(
          `Caldera Service port ${config.bCalderaServicePort} is already in use!\nClosing in 3 seconds...`,
        );
        await functions.sleep(3000);
        process.exit(1);
      } else {
        throw err;
      }
    });
}

app.use((req, res, next) => {
  const url = req.originalUrl;
  log.debug(
    `Missing endpoint: ${req.method} ${url} request port ${req.socket.localPort}`,
  );
  error.createError(
    "errors.com.epicgames.common.not_found",
    "Sorry the resource you were trying to find could not be found",
    undefined,
    1004,
    undefined,
    404,
    res,
  );
});

function DateAddHours(pdate, number) {
  let date = pdate;
  date.setHours(date.getHours() + number);

  return date;
}

module.exports = app;
