'use strict'

const fs = require("fs");
const util = require("util");
const url = require("url");
const puppeteer = require("puppeteer");
const log = require("loglevel");
const { gzip, brotli } = require("./compress");
const cmdline = require("./command_line");

// Promisified version of some fs operations.
const readdirPromisified = util.promisify(fs.readdir);
const readFilePromisified = util.promisify(fs.readFile)
const writeFilePromisified = util.promisify(fs.writeFile)

// In-memory cache of rendered pages. Note: this will be cleared whenever the
// server process stops. If you need true persistence, create a file using
// the copyToDir parameter of ssr.
const RENDER_CACHE = new Map();

// Initialize the browser.
let browserWSEndpoint = null;

async function startBrowser() {
  log.debug("spawning headless browser");

  try {
    const browser = await puppeteer.launch({
      headless: cmdline.headless,
      args: ["--no-proxy-server"]
    });

    browserWSEndpoint = await browser.wsEndpoint();

    log.info("browser created");
  } catch(err) {
    log.error("Unable to launch browser: ", err.message);
    throw err;
  }

  return browserWSEndpoint; // FIXME: Do I need to return something to actually await?
}

// opts is an object: 
// {
//   url: string;
//   fetch: string;
//   timeout: number;     // how long to wait to try to load the page. can optimize memory use on errors.
//   blacklist: string[]  // array of files to blacklist loading.
//   whiteResources: string[]  // array of whitelisted resource types.
//   encoding: string  // what encoding the content should be in.
//   copyToDir: string | undefined // If truthy, then create a copy of the rendered page in this directory. 
// }
async function ssr(opts) {
  if (RENDER_CACHE.has(opts.encoding + "_" + opts.url)) {
    log.debug(`Rendered version for ${opts.url} is in cache with encoding "${opts.encoding}".`);

    return { content: RENDER_CACHE.get(opts.encoding + "_" + opts.url), ttRenderMs: 0 };
  }

  const timeout = opts.timeout || 30000;
  const blacklist = opts.blacklist || [];
  const whitelist = opts.whiteResources || [];

  // Add a headless query onto the fetch URL.
  const fetchUrl = new url.URL(opts.fetch);
  const fetchSearch = new url.URLSearchParams(fetchUrl.searchParams);
  fetchSearch.append("headless", "true");
  fetchUrl.search = fetchSearch;
  opts.fetch = fetchUrl.href;

  log.debug(`Rendering for ${opts.url} via ${opts.fetch}`);

  const start = Date.now();

  const browser = await puppeteer.connect({browserWSEndpoint});
  const page = await browser.newPage();
  try {
    // intercept network requests to reject files being loaded when doing ssr.
    await page.setRequestInterception(true);
    page.on('request', req => {
      try {
        // Ignore requests for resources that don't produce DOM
        // (e.g. images, stylesheets, media).
        if (!whitelist.includes(req.resourceType())) {
          log.debug(`ssr whitelist rejects: ${req.resourceType()}->${req.url()}`);
          return req.abort();
        }

        // Ignore any blacklisted files.
        if(blacklist.find(regex => req.url().match(regex))) {
          log.debug(`ssr blacklist rejects: ${req.resourceType()}->${req.url()}`);
          return req.abort();
        }

        log.debug(`ssr passthrough allows: ${req.resourceType()}->${req.url()}`);

        // Pass through all other requests.
        return req.continue();
      } catch(err) {
        return req.abort();
      }
    });

    // networkidle0 waits for the network to be idle (no requests for 500ms).
    // The page's JS has likely produced markup by this point, but wait longer
    // if your site lazy loads, etc.
    await page.goto(opts.fetch, { waitUntil: "networkidle0", timeout: timeout });
  } catch (err) {
    log.error(err);
    throw new Error("page.goto timed out.");
  }

  try {
    const html = await page.content(); // serialized HTML of page DOM.
    const gzippedHtml = await gzip(html); // gzip compressed version of HTML.
    const bredHtml = await brotli(html); // brotli compressed version of HTML.

    // Cache rendered pages
    RENDER_CACHE.set("_" + opts.url, html);
    RENDER_CACHE.set("gzip_" + opts.url, gzippedHtml);
    RENDER_CACHE.set("br_" + opts.url, bredHtml);

    // Save pages to file
    if(opts.copyToDir) {
      const writeOptions = {encoding: "utf8", mode: cmdline.mode, flag: "w"};
      const fileBase = opts.copyToDir + (fetchUrl.pathname === "/" ? "/index" : fetchUrl.pathname) + cmdline.fileExt;
      console.debug(`saving files with base: ${fileBase}`);
      try {
        await writeFilePromisified(fileBase, html, writeOptions);
        await writeFilePromisified(fileBase + ".gz", gzippedHtml, writeOptions);
        await writeFilePromisified(fileBase + ".br", bredHtml, writeOptions);
      } catch(err) {
        log.error(`unable to save file ${fileBase}: ${err}`);
      }
    }
  } catch(err) {
    log.error(`unable to render and compress repsonse: ${err}`);
  }

  await page.close();

  const ttRenderMs = Date.now() - start;
  log.info(`Headless rendered page ${opts.fetch} in: ${ttRenderMs}ms`);

  return { content: RENDER_CACHE.get(opts.encoding + "_" + opts.url), ttRenderMs };
}

module.exports = { ssr, startBrowser };
