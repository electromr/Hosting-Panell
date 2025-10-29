/**
 * CHUNKDASH Feastic Theme
 *
 * ChunkDash 14.11.0 ― Cascade Ridge
 *
 * This file represents the main entry point of the ChunkDash application.
 * It loads the necessary packages, settings, and databases.
 * It also handles the routing and rendering of web pages.
 * @module index
 */

"use strict";

// Load logging.
require("./misc/console.js")();

// Load packages.
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const chalk = require("chalk");
const axios = require("axios");
global.Buffer = global.Buffer || require("buffer").Buffer;

if (typeof btoa === "undefined") {
  global.btoa = function (str) {
    return new Buffer(str, "binary").toString("base64");
  };
}
if (typeof atob === "undefined") {
  global.atob = function (b64Encoded) {
    return new Buffer(b64Encoded, "base64").toString("binary");
  };
}

// Load settings.
const settings = require("./settings.json");

const defaultthemesettings = {
  index: "index.ejs",
  notfound: "index.ejs",
  redirect: {},
  pages: {},
  mustbeloggedin: [],
  mustbeadmin: [],
  variables: {},
};

module.exports.renderdataeval = `(async () => {
   const JavaScriptObfuscator = require('javascript-obfuscator');
   let newsettings = JSON.parse(require("fs").readFileSync("./settings.json"));
    let renderdata = {
      req: req,
      settings: newsettings,
      userinfo: req.session.userinfo,
      packagename: req.session.userinfo ? await db.get("package-" + req.session.userinfo.id) ? await db.get("package-" + req.session.userinfo.id) : newsettings.api.client.packages.default : null,
      extraresources: !req.session.userinfo ? null : (await db.get("extra-" + req.session.userinfo.id) ? await db.get("extra-" + req.session.userinfo.id) : {
        ram: 0,
        disk: 0,
        cpu: 0,
        servers: 0
      }),
		packages: req.session.userinfo ? newsettings.api.client.packages.list[await db.get("package-" + req.session.userinfo.id) ? await db.get("package-" + req.session.userinfo.id) : newsettings.api.client.packages.default] : null,
      coins: newsettings.api.client.coins.enabled == true ? (req.session.userinfo ? (await db.get("coins-" + req.session.userinfo.id) ? await db.get("coins-" + req.session.userinfo.id) : 0) : null) : null,
      pterodactyl: req.session.pterodactyl,
      extra: theme.settings.variables,
	  db: db
    };
    
    // Add username and user email to renderdata for displaying in templates
    if (req.session.userinfo) {
      renderdata.username = req.session.userinfo.username;
      renderdata.useremail = req.session.userinfo.email;
    }
    
     renderdata.arcioafktext = JavaScriptObfuscator.obfuscate(\`
     let everywhat = \${newsettings.api.afk.every};
     let gaincoins = \${newsettings.api.afk.coins};
     let wspath = "ws";

     \${arciotext}
    \`);
    return renderdata;
  })();`;

// Load database

const Keyv = require("keyv");
const db = new Keyv(settings.database);

db.on("error", (err) => {
  console.log(
    chalk.red(
      "Database ― An error has occured when attempting to access the SQLite database."
    )
  );
});

module.exports.db = db;

// Load websites.

const express = require("express");
const app = express();
require("express-ws")(app);

// Load express addons.

const ejs = require("ejs");
const session = require("express-session");
const arciotext = require("./misc/afk.js");
const bodyParser = require('body-parser');

// Load the website.

module.exports.app = app;

app.use(
  session({
    secret: settings.website.secret,
    resave: false,
    saveUninitialized: false,
  })
);

// Add body parser middleware
app.use(express.urlencoded({ extended: true }));
app.use(
  express.json({
    inflate: true,
    limit: "500kb",
    reviver: null,
    strict: true,
    type: "application/json",
    verify: undefined,
  })
);

const listener = app.listen(settings.website.port, function () {
  console.clear();
  console.log(
    chalk.white(" Application is online at ") +
      chalk.gray(chalk.underline(settings.api.client.oauth2.link + "/"))
  );
});

var cache = false;
app.use(function (req, res, next) {
  let manager = JSON.parse(fs.readFileSync("./settings.json").toString()).api
    .client.ratelimits;
  if (manager[req._parsedUrl.pathname]) {
    if (cache == true) {
      setTimeout(async () => {
        let allqueries = Object.entries(req.query);
        let querystring = "";
        for (let query of allqueries) {
          querystring = querystring + "&" + query[0] + "=" + query[1];
        }
        querystring = "?" + querystring.slice(1);
        res.redirect(
          (req._parsedUrl.pathname.slice(0, 1) == "/"
            ? req._parsedUrl.pathname
            : "/" + req._parsedUrl.pathname) + querystring
        );
      }, 1000);
      return;
    } else {
      cache = true;
      setTimeout(async () => {
        cache = false;
      }, 1000 * manager[req._parsedUrl.pathname]);
    }
  }
  next();
});

// Load the API files.
let apifiles = fs.readdirSync("./api").filter((file) => file.endsWith(".js"));

apifiles.forEach((file) => {
  let apifile = require(`./api/${file}`);
  apifile.load(app, db);
});

app.all("*", async (req, res, next) => {
  // Skip auth checks for login and register pages - let oauth2.js handle them
  if (req._parsedUrl.pathname === "/login" || req._parsedUrl.pathname === "/register") {
    return next(); // Let oauth2.js handle these routes
  }
  
  if (req.session.pterodactyl)
    if (
      req.session.pterodactyl.id !==
      (await db.get("users-" + req.session.userinfo.id))
    )
      return res.redirect("/login?prompt=none");
  let theme = module.exports.get(req);
  let newsettings = JSON.parse(require("fs").readFileSync("./settings.json"));
  if (newsettings.api.afk.enabled == true)
    req.session.arcsessiontoken = Math.random().toString(36).substring(2, 15);
  if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname))
    if (!req.session.userinfo || !req.session.pterodactyl)
      return res.redirect(
        "/login" +
          (req._parsedUrl.pathname.slice(0, 1) == "/"
            ? "?redirect=" + req._parsedUrl.pathname.slice(1)
            : "")
      );
  if (theme.settings.mustbeadmin.includes(req._parsedUrl.pathname)) {
    ejs.renderFile(
      `./views/${theme.settings.notfound}`,
      await eval(module.exports.renderdataeval),
      null,
      async function (err, str) {
        delete req.session.newaccount;
        delete req.session.password;
        if (!req.session.userinfo || !req.session.pterodactyl) {
          if (err) {
            console.log(err);
            return res.render("500.ejs", { err });
          }
          res.status(200);
          return res.send(str);
        }

        let cacheaccount = await fetch(
          settings.pterodactyl.domain +
            "/api/application/users/" +
            (await db.get("users-" + req.session.userinfo.id)) +
            "?include=servers",
          {
            method: "get",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${settings.pterodactyl.key}`,
            },
          }
        );
        if ((await cacheaccount.statusText) == "Not Found") {
          if (err) {
            console.log(err);
            return res.render("500.ejs", { err });
          }
          return res.send(str);
        }
        let cacheaccountinfo = JSON.parse(await cacheaccount.text());

        req.session.pterodactyl = cacheaccountinfo.attributes;
        if (cacheaccountinfo.attributes.root_admin !== true) {
          if (err) {
            console.log(err);
            return res.render("500.ejs", { err });
          }
          return res.send(str);
        }

        ejs.renderFile(
          `./views/${
            theme.settings.pages[req._parsedUrl.pathname.slice(1)]
              ? theme.settings.pages[req._parsedUrl.pathname.slice(1)]
              : theme.settings.notfound
          }`,
          await eval(module.exports.renderdataeval),
          null,
          function (err, str) {
            delete req.session.newaccount;
            delete req.session.password;
            if (err) {
              console.log(err);
              return res.render("500.ejs", { err });
            }
            res.status(200);
            res.send(str);
          }
        );
      }
    );
    return;
  }
  const data = await eval(module.exports.renderdataeval);
  ejs.renderFile(
    `./views/${
      theme.settings.pages[req._parsedUrl.pathname.slice(1)]
        ? theme.settings.pages[req._parsedUrl.pathname.slice(1)]
        : theme.settings.notfound
    }`,
    data,
    null,
    function (err, str) {
      delete req.session.newaccount;
      delete req.session.password;
      if (err) {
        console.log(err);
        return res.render("500.ejs", { err });
      }
      res.status(200);
      res.send(str);
    }
  );
});

module.exports.get = function (req) {
  return {
    settings: fs.existsSync(`./views/pages.json`)
      ? JSON.parse(fs.readFileSync(`./views/pages.json`).toString())
      : defaultthemesettings
  };
};

module.exports.islimited = async function () {
  return cache == true ? false : true;
};

module.exports.ratelimits = async function (length) {
  if (cache == true) return setTimeout(module.exports.ratelimits, 1);
  cache = true;
  setTimeout(async function () {
    cache = false;
  }, length * 1000);
};
