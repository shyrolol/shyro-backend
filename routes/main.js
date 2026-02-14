const express = require("express");
const bcrypt = require("bcrypt");
const functions = require("../structs/functions.js");
const fs = require("fs");
const app = express.Router();
const log = require("../structs/log.js");
const path = require("path");
const { getAccountIdData, addEliminationHypePoints, addVictoryHypePoints, deductBusFareHypePoints } = require("./../structs/functions.js");
const eulaJson = JSON.parse(
  fs.readFileSync("./responses/eula/SharedAgreements.json", "utf8"),
);
const Profile = require("../model/profiles.js");
const keychain = require("../responses/keychain.json");
const Friends = require("../model/friends.js");
const error = require("../structs/error.js");
const User = require("../model/user.js");
const Arena = require("../model/arena.js");

const { verifyToken, verifyClient } = require("../token/tokenVerify.js");

const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

app.post("/fortnite/api/game/v2/chat/*/*/*/pc", (req, res) => {
  log.debug("POST /fortnite/api/game/v2/chat/*/*/*/pc called");
  let resp = config.chat.EnableGlobalChat
    ? { GlobalChatRooms: [{ roomName: "shyrobackendglobal" }] }
    : {};

  res.json(resp);
});

app.get("/fortnite/api/storefront/v2/catalog", (req, res) => {
  log.debug("Request to /fortnite/api/storefront/v2/catalog");
  if (req.headers["user-agent"] == undefined) return;
  if (req.headers["user-agent"].includes("2870186")) {
    return res.status(404).end();
  }

  res.json(functions.getItemShop());
});

app.get("/content/api/pages/fortnite-game/spark-tracks", async (req, res) => {
  const sparkTracks = require("./../responses/sparkTracks.json");

  res.json(sparkTracks);
});

app.get("/content/api/pages/*", async (req, res) => {
  const contentpages = functions.getContentPages(req);

  res.json(contentpages);
});

app.post("/api/v1/fortnite-br/surfaces/motd/target", async (req, res) => {
  res.status(204).end();
});

app.get("/fortnite/api/version", (req, res) => {
  res.json({
    app: "fortnite",
    serverDate: new Date().toISOString(),
    overridePropertiesVersion: "unknown",
    cln: "17951730",
    build: "444",
    moduleName: "Fortnite-Core",
    buildDate: "2021-10-27T21:00:51.697Z",
    version: "18.30",
    branch: "Release-18.30",
    modules: {
      "Epic-LightSwitch-AccessControlCore": {
        cln: "17237679",
        build: "b2130",
        buildDate: "2021-08-19T18:56:08.144Z",
        version: "1.0.0",
        branch: "trunk",
      },
      "epic-xmpp-api-v1-base": {
        cln: "5131a23c1470acbd9c94fae695ef7d899c1a41d6",
        build: "b3595",
        buildDate: "2019-07-30T09:11:06.587Z",
        version: "0.0.1",
        branch: "master",
      },
      "epic-common-core": {
        cln: "17909521",
        build: "3217",
        buildDate: "2021-10-25T18:41:12.486Z",
        version: "3.0",
        branch: "TRUNK",
      },
    },
  });
});

app.get("/fortnite/api*/versioncheck*", (req, res) => {
  res.json({
    type: "NO_UPDATE",
  });
});

app.get("/fortnite/api/v2/versioncheck/*", async (req, res) => {
  res.json({
    type: "NO_UPDATE",
  });
});

app.get("/fortnite/api/v2/versioncheck*", async (req, res) => {
  res.json({
    type: "NO_UPDATE",
  });
});

app.get("/fortnite/api/versioncheck*", async (req, res) => {
  res.json({
    type: "NO_UPDATE",
  });
});

app.get(
  "/fortnite/api/storefront/v2/gift/check_eligibility/recipient/:recipientId/offer/:offerId",
  verifyToken,
  async (req, res) => {
    log.debug(
      `Request to /fortnite/api/storefront/v2/gift/check_eligibility/recipient/${req.params.recipientId}/offer/${req.params.offerId}`,
    );
    const findOfferId = functions.getOfferID(req.params.offerId);
    if (!findOfferId)
      return error.createError(
        "errors.com.epicgames.fortnite.id_invalid",
        `Offer ID (id: "${req.params.offerId}") not found`,
        [req.params.offerId],
        16027,
        undefined,
        400,
        res,
      );

    let sender = await Friends.findOne({
      accountId: req.user.accountId,
    }).lean();

    if (
      !sender.list.accepted.find(
        (i) => i.accountId == req.params.recipientId,
      ) &&
      req.params.recipientId != req.user.accountId
    )
      return error.createError(
        "errors.com.epicgames.friends.no_relationship",
        `User ${req.user.accountId} is not friends with ${req.params.recipientId}`,
        [req.user.accountId, req.params.recipientId],
        28004,
        undefined,
        403,
        res,
      );

    const profiles = await Profile.findOne({
      accountId: req.params.recipientId,
    });

    let athena = profiles.profiles["athena"];

    for (let itemGrant of findOfferId.offerId.itemGrants) {
      for (let itemId in athena.items) {
        if (
          itemGrant.templateId.toLowerCase() ==
          athena.items[itemId].templateId.toLowerCase()
        )
          return error.createError(
            "errors.com.epicgames.modules.gamesubcatalog.purchase_not_allowed",
            `Could not purchase catalog offer ${findOfferId.offerId.devName}, item ${itemGrant.templateId}`,
            [findOfferId.offerId.devName, itemGrant.templateId],
            28004,
            undefined,
            403,
            res,
          );
      }
    }

    res.json({
      price: findOfferId.offerId.prices[0],
      items: findOfferId.offerId.itemGrants,
    });
  },
);

app.get("/fortnite/api/storefront/v2/keychain", (req, res) => {
  log.debug("Request to /fortnite/api/storefront/v2/keychain");
  res.json(keychain);
});

app.get("/catalog/api/shared/bulk/offers", (req, res) => {
  log.debug("Request to /catalog/api/shared/bulk/offers");
  res.json({});
});

app.get("/lightswitch/api/service/Fortnite/status", async (req, res) => {
  res.json({
    serviceInstanceId: "fortnite",
    status: "UP",
    message: "Fortnite is online",
    maintenanceUri: null,
    overrideCatalogIds: ["a7f138b2e51945ffbfdacc1af0541053"],
    allowedActions: [],
    banned: false,
    launcherInfoDTO: {
      appName: "Fortnite",
      catalogItemId: "4fe75bbc5a674f4f9b356b5c90567da5",
      namespace: "fn",
    },
  });
});

app.get("/lightswitch/api/service/bulk/status", async (req, res) => {
  res.json([
    {
      serviceInstanceId: "fortnite",
      status: "UP",
      message: "fortnite is up.",
      maintenanceUri: null,
      overrideCatalogIds: ["a7f138b2e51945ffbfdacc1af0541053"],
      allowedActions: ["PLAY", "DOWNLOAD"],
      banned: false,
      launcherInfoDTO: {
        appName: "Fortnite",
        catalogItemId: "4fe75bbc5a674f4f9b356b5c90567da5",
        namespace: "fn",
      },
    },
  ]);
});

app.get(
  "/fortnite/api/game/v2/privacy/account/:accountId",
  verifyToken,
  async (req, res) => {
    const profiles = await Profile.findOne({ accountId: req.user.accountId });

    if (!profiles) return res.status(400).end();

    res
      .json({
        accountId: profiles.accountId,
        optOutOfPublicLeaderboards:
          profiles.profiles.athena.stats.attributes.optOutOfPublicLeaderboards,
      })
      .end();
  },
);

app.post(
  "/fortnite/api/game/v2/privacy/account/:accountId",
  verifyToken,
  async (req, res) => {
    const profiles = await Profile.findOne({ accountId: req.user.accountId });

    if (!profiles) return res.status(400).end();

    let profile = profiles.profiles.athena;

    profile.stats.attributes.optOutOfPublicLeaderboards =
      req.body.optOutOfPublicLeaderboards;

    await profiles.updateOne({ $set: { [`profiles.athena`]: profile } });

    res
      .json({
        accountId: profiles.accountId,
        optOutOfPublicLeaderboards:
          profile.stats.attributes.optOutOfPublicLeaderboards,
      })
      .end();
  },
);

app.get("/eulatracking/api/shared/agreements/fn", async (req, res) => {
  res.json(eulaJson);
});

app.get(
  "/eulatracking/api/public/agreements/fn/account/:accountId",
  async (req, res) => {
    res.status(204).send();
  },
);

app.post("/fortnite/api/game/v2/tryPlayOnPlatform/account/*", (req, res) => {
  log.debug("POST /fortnite/api/game/v2/tryPlayOnPlatform/account/* called");
  res.setHeader("Content-Type", "text/plain");
  res.send(true);
});

app.get("/launcher/api/public/distributionpoints/", (req, res) => {
  log.debug("GET /launcher/api/public/distributionpoints/ called");
  res.json({
    distributions: [
      "https://download.epicgames.com/",
      "https://download2.epicgames.com/",
      "https://download3.epicgames.com/",
      "https://download4.epicgames.com/",
      "https://epicgames-download1.akamaized.net/",
    ],
  });
});

app.post("/api/launcher/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ status: "Invalid", message: "Missing fields" });
  }

  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({ status: "Invalid" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      return res.status(200).json({
        status: "Success",
        username: user.username,
        email: user.email,
        skin: user.skinUrl || "",
      });
    } else {
      return res.status(401).json({ status: "Invalid" });
    }
  } catch (err) {
    return res.status(500).json({ status: "Error" });
  }
});

app.get("/launcher/api/public/assets/*", async (req, res) => {
  res.json({
    appName: "FortniteContentBuilds",
    labelName: "shyroBackend",
    buildVersion: "++Fortnite+Release-20.00-CL-19458861-Windows",
    catalogItemId: "5cb97847cee34581afdbc445400e2f77",
    expires: "9999-12-31T23:59:59.999Z",
    items: {
      MANIFEST: {
        signature: "shyroBackend",
        distribution: "https://shyrobackend.ol.epicgames.com/",
        path: "Builds/Fortnite/Content/CloudDir/shyroBackend.manifest",
        hash: "55bb954f5596cadbe03693e1c06ca73368d427f3",
        additionalDistributions: [],
      },
      CHUNKS: {
        signature: "shyroBackend",
        distribution: "https://shyrobackend.ol.epicgames.com/",
        path: "Builds/Fortnite/Content/CloudDir/shyroBackend.manifest",
        additionalDistributions: [],
      },
    },
    assetId: "FortniteContentBuilds",
  });
});

app.get("/Builds/Fortnite/Content/CloudDir/*.manifest", async (req, res) => {
  res.set("Content-Type", "application/octet-stream");

  const manifest = fs.readFileSync(
    path.join(__dirname, "..", "responses", "CloudDir", "LawinServer.manifest"),
  );

  res.status(200).send(manifest).end();
});

app.get("/Builds/Fortnite/Content/CloudDir/*.chunk", async (req, res) => {
  res.set("Content-Type", "application/octet-stream");

  const chunk = fs.readFileSync(
    path.join(__dirname, "..", "responses", "CloudDir", "LawinServer.chunk"),
  );

  res.status(200).send(chunk).end();
});

app.post("/fortnite/api/game/v2/grant_access/*", async (req, res) => {
  log.debug("POST /fortnite/api/game/v2/grant_access/* called");
  res.json({});
  res.status(204);
});

app.post("/api/v1/user/setting", async (req, res) => {
  log.debug("POST /api/v1/user/setting called");
  res.json([]);
});

app.get("/Builds/Fortnite/Content/CloudDir/*.ini", async (req, res) => {
  const ini = fs.readFileSync(
    path.join(__dirname, "..", "responses", "CloudDir", "Full.ini"),
  );

  res.status(200).send(ini).end();
});

app.get("/waitingroom/api/waitingroom", (req, res) => {
  log.debug("GET /waitingroom/api/waitingroom called");
  res.status(204);
  res.end();
});

app.get("/socialban/api/public/v1/*", (req, res) => {
  log.debug("GET /socialban/api/public/v1/* called");
  res.json({
    bans: [],
    warnings: [],
  });
});

app.get(
  "/fortnite/api/game/v2/events/tournamentandhistory/*/EU/WindowsClient",
  (req, res) => {
    log.debug(
      "GET /fortnite/api/game/v2/events/tournamentandhistory/*/EU/WindowsClient called",
    );
    res.json({});
  },
);

app.get("/fortnite/api/statsv2/account/:accountId", (req, res) => {
  log.debug(`GET /fortnite/api/statsv2/account/${req.params.accountId} called`);
  res.json({
    startTime: 0,
    endTime: 0,
    stats: {},
    accountId: req.params.accountId,
  });
});

app.get("/statsproxy/api/statsv2/account/:accountId", (req, res) => {
  log.debug(
    `GET /statsproxy/api/statsv2/account/${req.params.accountId} called`,
  );
  res.json({
    startTime: 0,
    endTime: 0,
    stats: {},
    accountId: req.params.accountId,
  });
});

app.get(
  "/fortnite/api/stats/accountId/:accountId/bulk/window/alltime",
  (req, res) => {
    log.debug(
      `GET /fortnite/api/stats/accountId/${req.params.accountId}/bulk/window/alltime called`,
    );
    res.json({
      startTime: 0,
      endTime: 0,
      stats: {},
      accountId: req.params.accountId,
    });
  },
);

app.get("/d98eeaac-2bfa-4bf4-8a59-bdc95469c693", async (req, res) => {
  res.json({
    playlist:
      "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPE1QRCB4bWxucz0idXJuOm1wZWc6ZGFzaDpzY2hlbWE6bXBkOjIwMTEiIHhtbG5zOnhzaT0iaHR0cDovL3d3dy53My5vcmcvMjAwMS9YTUxTY2hlbWEtaW5zdGFuY2UiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4c2k6c2NoZW1hTG9jYXRpb249InVybjptcGVnOkRBU0g6c2NoZW1hOk1QRDoyMDExIGh0dHA6Ly9zdGFuZGFyZHMuaXNvLm9yZy9pdHRmL1B1YmxpY2x5QXZhaWxhYmxlU3RhbmRhcmRzL01QRUctREFTSF9zY2hlbWFfZmlsZXMvREFTSC1NUEQueHNkIiBwcm9maWxlcz0idXJuOm1wZWc6ZGFzaDpwcm9maWxlOmlzb2ZmLWxpdmU6MjAxMSIgdHlwZT0ic3RhdGljIiBtZWRpYVByZXNlbnRhdGlvbkR1cmF0aW9uPSJQVDMwLjIxM1MiIG1heFNlZ21lbnREdXJhdGlvbj0iUFQyLjAwMFMiIG1pbkJ1ZmZlclRpbWU9IlBUNC4xMDZTIj4KICA8QmFzZVVSTD5odHRwczovL2ZvcnRuaXRlLXB1YmxpYy1zZXJ2aWNlLXByb2QxMS5vbC5lcGljZ2FtZXMuY29tL2F1ZGlvL0phbVRyYWNrcy9PR1JlbWl4LzwvQmFzZVVSTD4KICA8UHJvZ3JhbUluZm9ybWF0aW9uPjwvUHJvZ3JhbUluZm9ybWF0aW9uPgogIDxQZXJpb2QgaWQ9IjAiIHN0YXJ0PSJQVDBTIj4KICAgIDxBZGFwdGF0aW9uU2V0IGlkPSIwIiBjb250ZW50VHlwZT0iYXVkaW8iIHN0YXJ0V2l0aFNBUD0iMSIgc2VnbWVudEFsaWdubWVudD0idHJ1ZSIgYml0c3RyZWFtU3dpdGNoaW5nPSJ0cnVlIj4KICAgICAgPFJlcHJlc2VudGF0aW9uIGlkPSIwIiBhdWRpb1NhbXBsaW5nUmF0ZT0iNDgwMDAiIGJhbmR3aWR0aD0iMTI4MDAwIiBtaW1lVHlwZT0iYXVkaW8vbXA0IiBjb2RlY3M9Im1wNGEuNDAuMiI+CiAgICAgICAgPFNlZ21lbnRUZW1wbGF0ZSBkdXJhdGlvbj0iMjAwMDAwMCIgdGltZXNjYWxlPSIxMDAwMDAwIiBpbml0aWFsaXphdGlvbj0iaW5pdF8kUmVwcmVzZW50YXRpb25JRCQubXA0IiBtZWRpYT0ic2VnbWVudF8kUmVwcmVzZW50YXRpb25JRCRfJE51bWJlciQubTRzIiBzdGFydE51bWJlcj0iMSI+PC9TZWdtZW50VGVtcGxhdGU+CiAgICAgICAgPEF1ZGlvQ2hhbm5lbENvbmZpZ3VyYXRpb24gc2NoZW1lSWRVcmk9InVybjptcGVnOmRhc2g6MjMwMDM6MzphdWRpb19jaGFubmVsX2NvbmZpZ3VyYXRpb246MjAxMSIgdmFsdWU9IjIiPjwvQXVkaW9DaGFubmVsQ29uZmlndXJhdGlvbj4KICAgICAgPC9SZXByZXNlbnRhdGlvbj4KICAgIDwvQWRhcHRhdGlvblNldD4KICA8L1BlcmlvZD4KPC9NUEQ+",
    playlistType: "application/dash+xml",
    metadata: {
      assetId: "",
      baseUrls: [
        "https://fortnite-public-service-prod11.ol.epicgames.com/audio/JamTracks/OGRemix/",
      ],
      supportsCaching: true,
      ucp: "a",
      version: "f2528fa1-5f30-42ff-8ae5-a03e3b023a0a",
    },
  });
});

app.post("/fortnite/api/feedback/*", (req, res) => {
  log.debug("POST /fortnite/api/feedback/* called");
  res.status(200);
  res.end();
});

app.post("/fortnite/api/statsv2/query", (req, res) => {
  log.debug("POST /fortnite/api/statsv2/query called");
  res.json([]);
});

app.post("/statsproxy/api/statsv2/query", (req, res) => {
  log.debug("POST /statsproxy/api/statsv2/query called");
  res.json([]);
});

app.post("/fortnite/api/game/v2/events/v2/setSubgroup/*", (req, res) => {
  log.debug("POST /fortnite/api/game/v2/events/v2/setSubgroup/* called");
  res.status(204);
  res.end();
});

app.get("/fortnite/api/game/v2/enabled_features", (req, res) => {
  log.debug("GET /fortnite/api/game/v2/enabled_features called");
  res.json([]);
});

app.get("/api/v1/events/Fortnite/download/*", async (req, res) => {
  const accountId = req.params.account_id;

  try {
    const playerData = await Arena.findOne({ accountId });
    const hypePoints = playerData ? playerData.hype : 0;
    const division = playerData ? playerData.division : 0;

    const eventsDataPath = path.join(
      __dirname,
      "./../responses/eventlistactive.json",
    );
    const events = JSON.parse(fs.readFileSync(eventsDataPath, "utf-8"));

    events.player = {
      accountId: accountId,
      gameId: "Fortnite",
      persistentScores: {
        Hype: hypePoints,
      },
      tokens: [`ARENA_S24_Division${division + 1}`],
    };

    res.json(events);
  } catch (error) {
    console.error("Fetching Arena", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/fortnite/api/game/v2/twitch/*", (req, res) => {
  log.debug("GET /fortnite/api/game/v2/twitch/* called");
  res.status(200);
  res.end();
});

app.get("/fortnite/api/game/v2/world/info", (req, res) => {
  log.debug("GET /fortnite/api/game/v2/world/info called");
  res.json({});
});

app.post(
  "/fortnite/api/game/v2/chat/*/recommendGeneralChatRooms/pc",
  (req, res) => {
    log.debug(
      "POST /fortnite/api/game/v2/chat/*/recommendGeneralChatRooms/pc called",
    );
    res.json({});
  },
);

app.get("/presence/api/v1/_/*/last-online", async (req, res) => {
  log.debug("GET /presence/api/v1/_/*/last-online called");
  res.json({});
});

app.get("/fortnite/api/receipts/v1/account/*/receipts", (req, res) => {
  log.debug("GET /fortnite/api/receipts/v1/account/*/receipts called");
  res.json([]);
});

app.get("/fortnite/api/game/v2/leaderboards/cohort/*", (req, res) => {
  log.debug("GET /fortnite/api/game/v2/leaderboards/cohort/* called");
  res.json([]);
});

app.post("/datarouter/api/v1/public/data", async (req, res) => {
  try {
    const accountId = getAccountIdData(req.query.UserID);
    const data = req.body.Events;

    if (Array.isArray(data) && data.length > 0) {
      const findUser = await User.findOne({ accountId });

      if (findUser) {
        for (const event of data) {
          const { EventName, ProviderType, PlayerKilledPlayerEventCount } =
            event;

          if (EventName && ProviderType === "Client") {
            const playerKills = Number(PlayerKilledPlayerEventCount) || 0;

          switch (EventName) {
            case "Athena.ClientWonMatch":
              await addVictoryHypePoints(findUser);
              await functions.SeasonXp(findUser, 70, false);
              await functions.updateUserLevel(req, findUser);
              break;

            case "Combat.AthenaClientEngagement":
              for (let i = 0; i < playerKills; i++) {
                await addEliminationHypePoints(findUser);
              }
              await functions.SeasonXp(findUser, 30 * playerKills, false);
              await functions.updateUserLevel(req, findUser);
              break;

            case "Combat.ClientPlayerDeath":
              await deductBusFareHypePoints(findUser);
              await functions.SeasonXp(findUser, 110, false);
              await functions.updateUserLevel(req, findUser);
              break;

            case "Core.ClientStartMatch":
              await functions.SeasonXp(findUser, 100, false);
              await functions.updateUserLevel(req, findUser);
              break;

            default:
              break;
          }
        }
      }
    } else {
    }
  }

    res.status(204).send();
} catch (error) {
  console.error("Error processing data router request:", error);
  res.status(500).send("Internal Server Error");
}
});

app.post("/api/v1/assets/Fortnite/*/*", async (req, res) => {
  log.debug("POST /api/v1/assets/Fortnite/*/* called");
  if (
    req.body.hasOwnProperty("FortCreativeDiscoverySurface") &&
    req.body.FortCreativeDiscoverySurface == 0
  ) {
    const discovery_api_assets = require("./../responses/Discovery/discovery_api_assets.json");
    res.json(discovery_api_assets);
  } else {
    res.json({
      FortCreativeDiscoverySurface: {
        meta: {
          promotion: req.body.FortCreativeDiscoverySurface || 0,
        },
        assets: {},
      },
    });
  }
});

app.get("/region", async (req, res) => {
  log.debug("GET /region called");
  res.json({
    continent: {
      code: "EU",
      geoname_id: 6255148,
      names: {
        de: "Europa",
        en: "Europe",
        es: "Europa",
        it: "Europa",
        fr: "Europe",
        ja: "ヨーロッパ",
        "pt-BR": "Europa",
        ru: "Европа",
        "zh-CN": "欧洲",
      },
    },
    country: {
      geoname_id: 2635167,
      is_in_european_union: false,
      iso_code: "GB",
      names: {
        de: "UK",
        en: "United Kingdom",
        es: "RU",
        it: "Stati Uniti",
        fr: "Royaume Uni",
        ja: "英国",
        "pt-BR": "Reino Unido",
        ru: "Британия",
        "zh-CN": "英国",
      },
    },
    subdivisions: [
      {
        geoname_id: 6269131,
        iso_code: "ENG",
        names: {
          de: "England",
          en: "England",
          es: "Inglaterra",
          it: "Inghilterra",
          fr: "Angleterre",
          ja: "イングランド",
          "pt-BR": "Inglaterra",
          ru: "Англия",
          "zh-CN": "英格兰",
        },
      },
      {
        geoname_id: 3333157,
        iso_code: "KEC",
        names: {
          en: "Royal Kensington and Chelsea",
        },
      },
    ],
  });
});

app.all("/v1/epic-settings/public/users/*/values", async (req, res) => {
  const epicsettings = require("./../responses/epic-settings.json");
  res.json(epicsettings);
});

app.get("/fortnite/api/game/v2/br-inventory/account/*", async (req, res) => {
  log.debug(
    `GET /fortnite/api/game/v2/br-inventory/account/${req.params.accountId} called`,
  );
  res.json({
    stash: {
      globalcash: 0,
    },
  });
});

module.exports = app;
