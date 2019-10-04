const zlib = require("zlib");
const brotli = require("iltorb");

module.exports = {
	brotli: (input, options) => {
		console.assert(typeof input === "string", "input type for brotli is not string");
		const buf = Buffer.from(input, "utf8");

		const promise = new Promise(function(resolve, reject) {
			brotli.compress(buf, options, function (error, result) {
				!error ? resolve(result) : reject(Error(error));
			});
		});
		return promise;
	},

	// FIXME: Looks like this won't be in node's zlib until version 10 or 11.
	// brotli: (input, options) => {
	// 	const promise = new Promise(function(resolve, reject) {
	// 		zlib.brotliCompress(input, options, function (error, result) {
	// 			!error ? resolve(result) : reject(Error(error));
	// 		});
	// 	});
	// 	return promise;
	// },
	gzip: (input, options) => {
		const promise = new Promise(function(resolve, reject) {
			zlib.gzip(input, options, function (error, result) {
				!error ? resolve(result) : reject(Error(error));
			});
		});
		return promise;
	}
};