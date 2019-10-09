'use strict'

const fs = require("fs");
const path = require("path");
const log = require("loglevel");

const parseArgs = require("minimist");

const opts = {
    string: ["blacklist", "cert", "copyToDir", "drop", "early", "fileExt", "key", "loglevel", "map", "mode", "port", "proxy", "public"],
    boolean: ["compress", "headfull", "help", "noserver"]
  };

const DEFAULT = {
	PORT: 8080,
	LOGLEVEL: log.levels.INFO
};

// Process command line arguments
const cmdline = process.argv.slice(2);
const parsed = parseArgs(cmdline, opts);

if(parsed.help) {
	console.log(`${process.execPath} --map "mapping key:value" [optional options]
	string/string array options can be repeated any number of times (see minimist package):
		[--blacklist item] Regex describing files which should not be included in the rendering.
		[--cert cert] SSL Certificate.
		[--key key] SSL Key.
		[--drop toUid:toGid] The uid and gid that the process should become as soon as possible. 
		[--early urlToEarlyRender] A list of URLs that should be rendered before listening for requests.
		[--loglevel 0-5] Set log levels according to the loglevel package. Default is ${DEFAULT.LOGLEVEL}
		[--map hostMapping] Array of JSON objects with from and to properties.
		[--port thisServerListenPort] What port should this server listen to for requests. Default is ${DEFAULT.PORT}.
		[--proxy behindThisProxy] Indicate that this server is behind this particular proxy.
		[--public staticFileDirectory] Serve static files from this directory.
		[--copyToDir directoryToPutRenderedFile] Generate a file for each page that is rendered.
		[--fileExt extension] Add extension to all files that are generated. For instance, it might be useful to add ".html".
		[--mode fileMode] Sets the file mode to be set when files are written.

	boolean options need only be provided once with no additional tokens:
		[--compress] Allows on the fly compression of reponses
		[--headfull] Show the normally headless chrome. Useful for debugging.
		[--help] Show this help
		[--noserver] Indicate that we don't need the server started. In other words, just run with files.`);

	// Indicate that we'd like the program to exit when it can.
	process.exit(0);
}

// Must have --map provided
console.assert(parsed._.length === 0, "Unhandled arguments!", parsed._);
console.assert(parsed.map, "No mapping provided", parsed.map);

// If noserver is provided, ensure that copyToDir is provided.
console.assert(parsed.noserver ? parsed.copyToDir && parsed.early : true, "--noserver should have --copyToDir and --early provided", parsed.noserver, parsed.copyToDir, parsed.early);

if(parsed.drop) {
	console.assert(parsed.drop.indexOf(":") !== -1, "expected uid:gid format", parsed.drop);
}

// Provide some default values in cases where none were provided. 
parsed.blacklist = parsed.blacklist ? (typeof parsed.blacklist === "string" ? [parsed.blacklist] : parsed.blacklist) : [];
parsed.cert = parsed.cert && path.resolve(parsed.cert); 
parsed.early = parsed.early ? (typeof parsed.early === "string" ? [parsed.early] : parsed.early) : [];
parsed.key = parsed.key && path.resolve(parsed.key); 
parsed.loglevel = parsed.loglevel ? parseInt(parsed.loglevel) : DEFAULT.LOGLEVEL;
parsed.port = parsed.port ? parseInt(parsed.port) : DEFAULT.PORT;
parsed.public = parsed.public && path.resolve(parsed.public);
parsed.headless = !parsed.headfull;
parsed.server = !parsed.noserver;
parsed.mode = parsed.mode || "444";
parsed.fileExt = parsed.fileExt || "";

try {
	parsed.map = JSON.parse(parsed.map);
} catch(err) {
	log.error(`unable to parse map parameter: ${err}`);
	parsed.map = [];
}

// Make sure the copyToDir exists
console.assert(!parsed.copyToDir || fs.existsSync(parsed.copyToDir), `copyToDir ${parsed.copyToDir} doesn't exist`);

// Start logging
log.setLevel(parsed.loglevel, false);

log.debug("command line %o becomes ", cmdline, parsed);

module.exports = parsed;