# Prerender and server side render using headless chrome.

Sometimes you have a need to prerender a bunch of stuff. Sometimes you have a need to quickly do server side rendering. This is just such a swiss army knife: it can be setup to proxy/server side render on the fly or just be used as a command line build tool to prerender a set of files.

## Installing

```
$ npm install --save-dev @phbalance/prerender-ssr
```

## Common use cases

### Prerender

Single page apps (SPA) can be tricky to make work with search engine optimization (SEO). The reason for this is that most, if not all, search engines don't run your website's JavaScript, they just parse out the "content" of the served webpage. Since SPAs rely on routing, the served page has no content. For a simple SPA with static pages, an easy solution is to just prerender the web pages during the "build" phase (i.e. prior to deployment).

This tool can be run in this mode by using the `noserver` argument.

A typical command line invocation would look like this:

```
prerender-ssr --map '[["https://example.com", "http://localhost:9999"]]' --noserver --copyToDir prerender --early https://example.com/ --early https://example.com/page2 --early https://example.com/page3
```

In this case, the tool is mapping (via the `--map` argument) any requests that start with `https://example.com` to `http://localhost:9999`. There is a requirement that you have a webserver serving the desired content be at the mapped address (`http://localhost:9999`). I use the [local-web-server npm package](https://www.npmjs.com/package/local-web-server) via `npx local-web-server --spa index.html --port 9999 --directory dist` but anything that works for you is fine.

The `--noserver` argument indicates that the tool should terminate after prerendering all the `--early` arguments and their parameters.

All files, because of the `copyToDir` argument, are output to the `prerender` directory.

#### Arguments

A list of important arguments for this use case are:
* `map` Array of JSON objects with from and to properties.

* `copyToDir` Generate a file for each page that is rendered.
* `early` A URL that should be rendered before listening for requests. Specify multiple times for many URLs.
* `fileExt` Add extension to all files that are generated. For instance, it might be useful to add ".html".
* `mode` Sets the file mode to be set when files are written. Default is (octal) "444".

* `noserver` Don't start a server to listen for incoming requests. In other words, just run with prerender.


### Proxy/server side renderer 

Have a look at the arguments for more detail, but here's a use case:

```
$ node ./server.js --port 8444 --key privkey.pem --cert fullchain.pem --drop "nonrootuid:nonrootgid" --early https://example.com/ --proxy https://example.com:443 --map "[[\"https://example.com\", \"https://example.com:8443\"]]"
```

This will start a server that proxies requests on port `8444` (`--port 8444`) for `https://example.com` to `https://example.com:8443` (`--map "[[\"https://example.com\", \"https://example.com:8443\"]]" --proxy https://example.com:443`)

It uses a key and certificate (`--key privkey.pem --cert fullchain.pem`).

It drops permissions to uid nonrootuid and gid nonrootgid (`--drop "nonrootuid:nonrootgid"`) before running the chrome headless browser or listening to port `8444`.

It will cache prerendered versions of `https://example.com/` before listening (`--early https://example.com/`).

### All Arguments

Argument processing is done in `command_line.js`.

#### arguments that need a parameter
* `blacklist` Regex describing files which should not be included in the rendering.
* `cert` SSL Certificate to use.
* `key` SSL Key to use.
* `drop` The uid and gid that the process should become as soon as possible.`
* `early` A URL that should be rendered before listening for requests. Specify multiple times for many URLs.
* `loglevel` Set log levels (according to the loglevel package) to this number. Default is loglevel.levels.INFO.
* `map` Array of JSON objects with from and to properties.
* `port` What port should this server listen to for requests. Default is 8080.
* `proxy` Indicate that this server is behind this particular proxy.
* `public` Serve static files from this directory.
* `copyToDir` Generate a file for each page that is rendered.
* `fileExt` Add extension to all files that are generated. For instance, it might be useful to add ".html".
* `mode` Sets the file mode to be set when files are written.

#### arguments that don't take a parameter
* `compress` Allows on the fly compression of reponses.
* `headfull` Show the normally headless chrome. Useful for debugging.
* `help` Show the usage description.
* `noserver` Don't start a server to listen for incoming requests. In other words, just run with prerender.

### Notes

The time cost can be seen in Chrome Devtools, or by alternative means, by inspecting the "Server-Timing" field in the header.

### Reference

- [Headless Chrome: an answer to server-side rendering JS sites](https://developers.google.com/web/tools/puppeteer/articles/ssr)
- [Server side render using headless chrome - GitHub repository](https://github.com/wayou/ssr-demo)
