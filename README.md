Prerender/server side render using headless chrome.

===

# Overview

Sometimes you have a need to prerender a bunch of stuff. This is just such a tool. It can be setup to proxy on the fly or just run a batch set of files. This readme doesn't really have much but it was a quick and dirty project.

# How to run

## Installing

```
$ npm install --save-dev 
```

### Run the server to prerender

Have a look at the command_line.js file for more detail, but here's a use case:

```
$ node ./server.js --port 8444 --key privkey.pem --cert fullchain.pem --drop "nonroot:nonroot" --early https://example.com/ --proxy https://example.com:443 --map "[[\"https://example.com\", \"https://example.com:8443\"]]"
```

### notes

See the time cost in Chrome Devtools by inspecting the "Server-Timing" field in the header.

### reference

- [Headless Chrome: an answer to server-side rendering JS sites](https://developers.google.com/web/tools/puppeteer/articles/ssr)
- [Server side render using headless chrome - GitHub repository](https://github.com/wayou/ssr-demo)
