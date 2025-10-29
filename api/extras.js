/**
 * |-| [- |_ | /\ ( ~|~ `/ |_
 *
 * Heliactyl 14.11.0 ― Cascade Ridge
 *
 * This is for miscellaneous extra endpoints.
 * @module extras
 */

const settings = require("../settings.json");
const fs = require("fs");
const indexjs = require("../app.js");
const fetch = require("node-fetch");
const Queue = require("../managers/Queue");
const log = require("../misc/log");

module.exports.load = async function (app, db) {
  app.get("/panel", async (req, res) => {
    res.redirect(settings.pterodactyl.domain);
  });

  app.get("/regen", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");

    let newsettings = JSON.parse(fs.readFileSync("./settings.json"));

    if (newsettings.api.client.allow.regen !== true)
      return res.send("You cannot regenerate your password currently.");

    let newpassword = makeid(
      newsettings.api.client.passwordgenerator["length"]
    );
    req.session.password = newpassword;

    await fetch(
      settings.pterodactyl.domain +
        "/api/application/users/" +
        req.session.pterodactyl.id,
      {
        method: "patch",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.pterodactyl.key}`,
        },
        body: JSON.stringify({
          username: req.session.pterodactyl.username,
          email: req.session.pterodactyl.email,
          first_name: req.session.pterodactyl.first_name,
          last_name: req.session.pterodactyl.last_name,
          password: newpassword,
        }),
      }
    );

    let theme = indexjs.get(req);
    res.redirect("/security");
  });

  /* Create a Queue */
  const queue = new Queue();

  app.get("/transfercoins", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect(`/`);

    const coins = parseInt(req.query.coins);
    if (!coins || !req.query.id)
      return res.redirect(`/transfer?err=MISSINGFIELDS`);
    if (req.query.id.includes(`${req.session.userinfo.id}`))
      return res.redirect(`/transfer?err=CANNOTGIFTYOURSELF`);

    if (coins < 1) return res.redirect(`/transfer?err=TOOLOWCOINS`);

    queue.addJob(async (cb) => {
      const usercoins = await db.get(`coins-${req.session.userinfo.id}`);
      const othercoins = await db.get(`coins-${req.query.id}`);
      if (!othercoins) {
        cb();
        return res.redirect(`/transfer?err=USERDOESNTEXIST`);
      }
      if (usercoins < coins) {
        cb();
        return res.redirect(`/transfer?err=CANTAFFORD`);
      }

      await db.set(`coins-${req.query.id}`, othercoins + coins);
      await db.set(`coins-${req.session.userinfo.id}`, usercoins - coins);

      log(
        "Gifted Coins",
        `${req.session.userinfo.username}#${req.session.userinfo.discriminator} sent ${coins}\ coins to the user with the ID \`${req.query.id}\`.`
      );
      cb();
      return res.redirect(`/transfer?err=none`);
    });
  });

  // Admin: create coupon code (coins 10-1000, usage limit)
  app.get("/admin/createcoupon", async (req, res) => {
    if (!req.session.pterodactyl || !req.session.pterodactyl.root_admin) {
      return res.status(403).send("Unauthorized");
    }

    try {
      const theme = indexjs.get(req);
      const fail = theme.settings.redirect.couponcreationfailed || "/admin";
      const ok = theme.settings.redirect.couponcreationsuccess || "/admin";

      const code = (req.query.code || "").trim();
      const value = parseInt(req.query.value);
      const uses = parseInt(req.query.uses);

      if (!code || isNaN(value) || isNaN(uses)) {
        return res.redirect(`${fail}?err=MISSINGFIELDS`);
      }
      
      if (value < 10 || value > 1000) {
        return res.redirect(`${fail}?err=INVALIDVALUE`);
      }
      
      if (uses < 1 || uses > 100000) {
        return res.redirect(`${fail}?err=INVALIDUSES`);
      }

      const key = `coupon-${code}`;
      
      // Check if coupon already exists
      const existing = await db.get(key);
      if (existing) {
        return res.redirect(`${fail}?err=ALREADYEXISTS`);
      }

      // Create the coupon
      await db.set(key, { value, usesLeft: uses });
      
      log.info(`Coupon created: ${code} worth ${value} coins with ${uses} uses`);
      return res.redirect(`${ok}?err=none`);
      
    } catch (error) {
      console.error("Error creating coupon:", error);
      return res.status(500).send("Internal server error");
    }
  });

  // User: redeem coupon code -> add coins
  app.get("/redeemcoupon", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");
    const theme = indexjs.get(req);
    const fail = theme.settings.redirect.missingorinvalidcouponcode || "/redeem";
    const ok = theme.settings.redirect.successfullyredeemedcoupon || "/redeem";

    const code = (req.query.code || "").trim();
    if (!code) return res.redirect(`${fail}?err=MISSINGCODE`);

    const userId = req.session.userinfo.id;

    // Check if user has already redeemed this code
    const userRedeemedKey = `coupon-redeemed-${userId}-${code}`;
    if (await db.get(userRedeemedKey)) {
      return res.redirect(`${fail}?err=ALREADYREDEEMED`);
    }

    const key = `coupon-${code}`;
    const data = await db.get(key);
    if (!data || typeof data !== "object")
      return res.redirect(`${fail}?err=INVALIDCODE`);

    if (!data.usesLeft || data.usesLeft <= 0)
      return res.redirect(`${fail}?err=CODEEXHAUSTED`);

    const current = (await db.get(`coins-${userId}`)) || 0;
    const newCoins = current + data.value;
    await db.set(`coins-${userId}`, newCoins);

    // Mark this user as having redeemed this code
    await db.set(userRedeemedKey, true);

    data.usesLeft = data.usesLeft - 1;
    if (data.usesLeft <= 0) {
      await db.delete(key);
    } else {
      await db.set(key, data);
    }

    return res.redirect(`${ok}?err=none`);
  });
};

function makeid(length) {
  let result = "";
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
