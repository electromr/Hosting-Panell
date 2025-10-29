const indexjs = require("../app.js");
const adminjs = require("./admin.js");
const settings = require("../settings.json");
const fs = require("fs");
const ejs = require("ejs");
const log = require("../misc/log");

module.exports.load = async function (app, db) {
  app.get("/buy", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");

    let newsettings = await enabledCheck(req, res);
    if (!newsettings) return;

    const { type, amount, server } = req.query;
    if (!type || !amount) return res.send("Missing type or amount");

    // Only allow buying resources that can be applied to an existing server
    const validTypes = ["ram", "disk", "cpu"];
    if (!validTypes.includes(type)) return res.send("Invalid type");

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 1 || parsedAmount > 10)
      return res.send("Amount must be a number between 1 and 10");

    const theme = indexjs.get(req);
    const failedCallbackPath =
      theme.settings.redirect[`failedpurchase${type}`] || "/";

    const userCoins = (await db.get(`coins-${req.session.userinfo.id}`)) || 0;

    const { per, cost } = newsettings.api.client.coins.store[type];
    const purchaseCost = cost * parsedAmount;

    if (userCoins < purchaseCost)
      return res.redirect(`${failedCallbackPath}?err=CANNOTAFFORD`);

    // Require target server and verify ownership
    if (!server) return res.redirect(`${failedCallbackPath}?err=MISSINGSERVER`);
    const ownedServer = req.session.pterodactyl.relationships.servers.data.find(
      (s) => s.attributes && s.attributes.id.toString() === server.toString()
    );
    if (!ownedServer) return res.redirect(`${failedCallbackPath}?err=INVALIDSERVER`);

    const extraResource = per * parsedAmount;

    // Build updated limits by adding purchased amount
    const currentLimits = ownedServer.attributes.limits;
    const newLimits = {
      memory: type === "ram" ? currentLimits.memory + extraResource : currentLimits.memory,
      disk: type === "disk" ? currentLimits.disk + extraResource : currentLimits.disk,
      cpu: type === "cpu" ? currentLimits.cpu + extraResource : currentLimits.cpu,
      swap: typeof currentLimits.swap === "number" ? currentLimits.swap : 0,
      io: typeof currentLimits.io === "number" ? currentLimits.io : 500,
    };

    // Apply directly on Pterodactyl
    const fetch = require("node-fetch");
    const serverinfo = await fetch(
      settings.pterodactyl.domain +
        "/api/application/servers/" +
        ownedServer.attributes.id +
        "/build",
      {
        method: "patch",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.pterodactyl.key}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          limits: newLimits,
          feature_limits: ownedServer.attributes.feature_limits,
          allocation: ownedServer.attributes.allocation,
        }),
      }
    );
    if ((await serverinfo.statusText) !== "OK")
      return res.redirect(`${failedCallbackPath}?err=ERRORONAPPLY`);

    // Deduct coins
    const newUserCoins = userCoins - purchaseCost;
    if (newUserCoins === 0) {
      await db.delete(`coins-${req.session.userinfo.id}`);
    } else {
      await db.set(`coins-${req.session.userinfo.id}`, newUserCoins);
    }

    adminjs.suspend(req.session.userinfo.id);

    log(
      `Resources Purchased`,
      `${req.session.userinfo.username}#${req.session.userinfo.discriminator} bought ${extraResource} ${type} applied to server ID ${ownedServer.attributes.id} for \`${purchaseCost}\` coins.`
    );

    res.redirect(
      (theme.settings.redirect[`purchase${type}`]
        ? theme.settings.redirect[`purchase${type}`]
        : "/") + "?err=none"
    );
  });

  async function enabledCheck(req, res) {
    const newsettings = JSON.parse(
      fs.readFileSync("./settings.json").toString()
    );
    if (newsettings.api.client.coins.store.enabled) return newsettings;

    const theme = indexjs.get(req);
    ejs.renderFile(
      `./views/${theme.settings.notfound}`,
      await eval(indexjs.renderdataeval),
      null,
      function (err, str) {
        delete req.session.newaccount;
        if (err) {
          console.log(
            `App ― An error has occurred on path ${req._parsedUrl.pathname}:`
          );
          console.log(err);
          return res.send(
            "An error has occurred while attempting to load this page. Please contact an administrator to fix this."
          );
        }
        res.status(200);
        res.send(str);
      }
    );
    return null;
  }
};
