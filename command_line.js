'use strict'

const fs = require("fs");
const path = require("path");

const log = require("loglevel");
const parseArgs = require("minimist");

const DEFAULT = {
	PORT: 8080,
	LOGLEVEL: log.levels.INFO,
	MODE: "444"
};

const options = [
	{ name: "blacklist", param: "item", desc: `Regex describing files which should not be included in the rendering.` },
	{ name: "cert", param: "cert", desc: `SSL Certificate to use.` },
	{ name: "key", param: "key", desc: `SSL Key to use.` },
	{ name: "drop", param: "toUid:toGid", desc: `The uid and gid, separated by a colon, that the process should become as soon as possible.` },
	{ name: "early", param: "urlToEarlyRender", desc: `A URL that should be rendered before listening for requests. Specify multiple times for many URLs.` },
	{ name: "loglevel", param: "0-5", desc: `Set log levels (according to the loglevel package) to this number. Default is ${DEFAULT.LOGLEVEL}.` },
	{ name: "map", param: "hostMapping", desc: `Array of JSON objects with from and to properties.` },
	{ name: "port", param: "thisServerListenPort", desc: `What port should this server listen to for requests. Default is ${DEFAULT.PORT}.` },
	{ name: "proxy", param: "behindThisProxy", desc: `Indicate that this server is behind this particular proxy.` },
	{ name: "public", param: "staticFileDirectory", desc: `Serve static files from this directory.` },
	{ name: "copyToDir", param: "directoryToPutRenderedFile", desc: `Generate a file for each page that is rendered.` },
	{ name: "fileExt", param: "extension", desc: `Add extension to all files that are generated. For instance, it might be useful to add ".html".` },
	{ name: "mode", param: "fileMode", desc: `Sets the file mode to be set when files are written. Default is (octal) ${DEFAULT.MODE}.` },

	{ name: "compress", desc: `Allows on the fly compression of reponses.` },
	{ name: "headfull", desc: `Show the normally headless chrome. Useful for debugging.` },
	{ name: "help", desc: `Show the usage description.` },
	{ name: "noserver", desc: `Don't start a server to listen for incoming requests. In other words, just run as a prerender.` },
];

const opts = {
	string: options.filter((option) => option.param).map((option) => option.name).sort(),
	boolean: options.filter((option) => !option.param).map((option) => option.name).sort(),
}

// Process command line arguments
const cmdline = process.argv.slice(2);
const parsed = parseArgs(cmdline, opts);

if(parsed.help) {
	console.log(`${process.execPath} --map "mapping key:value" [optional options]\n`,
		`Supported string options which can be repeated any number of times (see minimist package):\n`,
		`${options.filter((option) => option.param).reduce((accum, option) => accum + `\t[--${option.name} ${option.param}] ${option.desc}\n`, "")}\n`,
		`Supported boolean options are:`,
		`${options.filter((option) => option.param).reduce((accum, option) => accum + `\n\t[--${option.name}] ${option.desc}`, "")}`);

	// Indicate that we'd like the program to exit when it can.
	process.exit(0);
}

// Must have --map provided
console.assert(parsed._.length === 0, "Unhandled arguments!", parsed._);
console.assert(parsed.map, "No mapping provided");

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
parsed.mode = parsed.mode || DEFAULT.MODE;
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