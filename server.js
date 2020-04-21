// NOTE: Uses await etc so requires at least node 7.6
'use strict'

const url = require("url");
const zlib = require("zlib");
const fs = require("fs");

const cmdline = require("./command_line");
const express = require("express");
const accept = require("@hapi/accept");
const https = require("https");
const { createProxyMiddleware } = require("http-proxy-middleware");
const compression = require("compression");
const { ssr, startBrowser } = require("./ssr");
const log = require("loglevel");


// Start the server.
const app = express();

// Enable on the fly compression?
if(cmdline.compression) {
  log.info("on the fly compression enabled");
  app.use(compression({ level: zlib.Z_BEST_COMPRESSION }));
}

// Do we know for sure that we're behind a proxy?
if(cmdline.proxy) {
  log.info("behind a proxy: ", cmdline.proxy);

  // From docs:
  // Enabling trust proxy will have the following impact:
  // The value of req.hostname is derived from the value set in the X-Forwarded-Host header, which can be set by the client or by the proxy.
  // X-Forwarded-Proto can be set by the reverse proxy to tell the app whether it is https or http or even an invalid name. This value is reflected by req.protocol.
  // The req.ip and req.ips values are populated with the list of addresses from X-Forwarded-For.
  app.enable("trust proxy", cmdline.proxy);
}

// Serving static files?
if(cmdline.public) {
  log.info("starting static server");
  app.use(express.static(cmdline.public, { index: false }));
}

const proxyMap = new Map(cmdline.map);

const preRenderUrl = async (req, res, next) => {
  // Does this URL look like something we render?
  if(!req.originalUrl.match(/.(js|js.map|css|jpg|jpeg|png|ico|txt|xml)$/)) {
    const protHostPort = `${req.protocol}://${req.get('Host')}`;
    const pretendToBeUrl = `${protHostPort}${req.originalUrl}`;
    const fetchFromUrl = `${proxyMap.get(protHostPort)}${req.originalUrl}`;

    // Choose the appropriate response encoding. We can support brotli, gzip, and 
    // the identity transform. Give priority to brotli then gzip and finally nothing.
    const encoding = accept.encoding(req.headers["accept-encoding"], ["br", "gzip"]);
    log.debug(`decided response encoding is ${encoding} from "${req.headers["accept-encoding"]}"`);
    log.debug(`ssr request: ${pretendToBeUrl}`);

    try {
      const { content, ttRenderMs } = await ssr({
          url: pretendToBeUrl,
          fetch: fetchFromUrl,
          timeout: 5000,
          blacklist: cmdline.blacklist,
          whiteResources: ["document", "script", "xhr", "fetch"],
          encoding: encoding,
          copyToDir: cmdline.copyToDir
        });

      res.set({ 
        "Server-Timing": `Prerender;dur=${ttRenderMs};desc="Headless render time (ms)"`,
        "Content-Encoding": encoding,
        "Content-Length": content.length,
        "Content-Type": "text/html"
      });

      return res.status(200).send(content);
    } catch(err) {
      log.error("render error", err.message);
      return res.status(404).send("error with rendering");
    }

  } else {
    // Pass on to the proxy
    return next();
  }
};

const sendToProxy = createProxyMiddleware({ 
  target: "http://localhost:9", // This is the default route if router returns falsy. It's the discard port. https://en.wikipedia.org/wiki/Discard_Protocol
  changeOrigin: true, 
  ws: false,
  secure: true,
  onProxyReq: (proxyReq, req, res) => { 
    log.debug(`proxying ${req.protocol}://${req.get('Host')}${req.originalUrl}`); 
  },
  router: (req) => {
    const proxyFrom = `${req.protocol}://${req.get('Host')}`;
    const proxyTo = proxyMap.get(proxyFrom);
    log.debug(`proxy router ${proxyFrom} to ${proxyTo}`);
    return proxyTo;
  }
});

// Redirect GET on all routes and redirect them to either the 
// SSR version or send along to the proxy for the authoritive 
// answer.
app.get("*", preRenderUrl, sendToProxy);

async function runEarlyPreRender() {
  // Run any initial rendering that is required.
  for(let i = 0; i < cmdline.early.length; ++i) {
    const urlToRender = cmdline.early[i];

    log.debug(`premptive rendering for ${urlToRender}`);

    const renderUrl = new url.URL(urlToRender);
    const protHostPort = `${renderUrl.origin}`;
    const fetchFromUrl = `${proxyMap.get(protHostPort)}${renderUrl.pathname}${renderUrl.search}${renderUrl.hash}`;

    try {
      await ssr({
        url: urlToRender,
        fetch: fetchFromUrl,
        timeout: 5000,
        blacklist: cmdline.blacklist,
        whiteResources: ["document", "script", "xhr", "fetch"], // FIXME: used in 2 places.
        encoding: "gzip", // doesn't matter so picking something at random.
        copyToDir: cmdline.copyToDir
      });
    } catch(err) {
      log.error(`unable to early render ${urlToRender} via ${fetchFromUrl}: ${err.message}`);
    }
  } 
}

async function init() {

  // Secure server or not?
  let server = app;
  if(cmdline.key && cmdline.cert && cmdline.server) {
    log.info("Starting secure server");

    const privateKey = fs.readFileSync(cmdline.key, "utf8");
    const certificate = fs.readFileSync(cmdline.cert, "utf8");

    server = https.createServer({
        key: privateKey,
        cert: certificate
    }, app);
  }

  if(cmdline.drop) {
    const ids = cmdline.drop.split(":");
    log.debug("dropping privileges to %s based off %s:%s", cmdline.drop, ids[0], ids[1]);
    process.setgid(ids[1]);
    process.setuid(ids[0]);
    log.debug("now %s:%s", process.getuid(), process.getgid());
  }

  await startBrowser();

  await runEarlyPreRender();

  // Make the server listen and then we're off to the races.
  if(cmdline.server) {
    server.listen(cmdline.port, 
                  () => { 
                    log.info("Server started on port %d. Press Ctrl+C to quit", cmdline.port);
                  });
  } else {
    console.log("Done preredering all files. Exiting.");

    // Indicate that we'd like the program to exit when it can.
    process.exit(0);
  }
}

init();