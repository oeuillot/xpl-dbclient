/*jslint node: true, vars: true, nomen: true, esversion: 6 */
'use strict';

const debug = require('debug')('xpl-dbclient:query');
const Memcache = require('./memcache');
const request = require('request');
const Semaphore = require('semaphore');
const Querystring = require('querystring');

class Query {

	constructor(configuration) {
		this._configuration = configuration || {};

		this._semaphore = Semaphore(1);
	}

	static fillCommander(commander) {
		commander.option("--queryServer <url>", "Query server URL");

		Memcache.fillCommander(commander);
	}

	_initializeMemcache(callback) {
		if (this._memcache) {
			return callback(null, this._memcache);
		}

		var semaphore = this._semaphore;

		semaphore.take(() => {
			if (this._memcache) {
				semaphore.leave();

				return callback(null, this._memcache);
			}

			var conf = Object.assign({}, this._configuration);

			debug("_initializeMemcache", "Initialize memcache ...", conf);

			var memcache = new Memcache(conf);

			memcache.initialize((error) => {
				debug("_initializeMemcache", "Memcache initialization returns", error);
				if (error) {
					semaphore.leave();

					return callback(error);
				}

				this._memcache = memcache;
				semaphore.leave();

				callback(null, memcache);
			});
		});
	}

	_getQueryURL(memcache, callback) {
		if (this._configuration.queryServer) {
			callback(null, this._configuration.queryServer);
			return;
		}

		memcache.getRestServerURL((error, url) => {
			if (error) {
				debug("_getQueryURL", "Memcache queryURL error=", error);
				callback(error);
				return;
			}

			debug("_getQueryURL", "Memcache queryURL url=", url);
			callback(null, url);
		});
	}

	getValue(path, callback) {
		getLast(path, callback);
	}

	getLast(path, callback) {
		this._initializeMemcache((error, memcache) => {
			if (error) {
				return callback(error);
			}

			this._getLast(path, memcache, callback);
		})
	}

	_getLast(path, memcache, callback) {
		debug("_getValue", "path=", path);

		memcache.getCurrent(path, (error, value) => {
			debug("_getValue", "memcache returns value=", value, "error=", error);

			if (!error) {
				if (value) {
					return callback(null, value);
				}
				if (value === "") {
					return callback(null, null);
				}
			}

			if (error) {
				console.error(error);
			}

			this._getQueryURL(memcache, (error, queryURL) => {
				if (error) {
					return callback(error);
				}

				if (!queryURL) {
					return callback(new Error("No query URL"));
				}

				var options = {
					url: queryURL + '/last/' + path,
					json: true
				};

				debug("_getValue", "send request to", options);

				request(options, (error, response, body) => {

					debug("_getValue", "Request response error=", error, "body=", body);

					if (error) {
						return callback(error);
					}

					if (response.statusCode !== 200) {
						debug("_getValue", "Status code=", response.statusCode);
						return callback(null, null);
					}

					if (body && (typeof(body.date) === "string" || typeof(body.date) === "number")) {
						body.date = new Date(body.date);
					}

					callback(null, body);
				});
			});
		});
	}

	getMinMaxAvgSum(path, options, callback) {
		this._initializeMemcache((error, memcache) => {
			if (error) {
				return callback(error);
			}

			this._getMinMaxAvgSum(path, options, memcache, callback);
		})
	}

	_getMinMaxAvgSum(path, options, memcache, callback) {
		debug("_getMinMaxAvgSum", "path=", path, "options=", options);

		this._getQueryURL(memcache, (error, queryURL) => {
			if (error) {
				return callback(error);
			}

			if (!queryURL) {
				return callback(new Error("No query URL"));
			}

			var options = {
				url: queryURL + '/minMaxAvgSum/' + path + '?' + stringify(options),
				json: true
			};

			debug("_getMinMaxAvgSum", "send request to", options);

			request(options, (error, response, body) => {

				debug("_getMinMaxAvgSum", "Request response error=", error, "body=", body);

				if (error) {
					return callback(error);
				}

				if (response.statusCode !== 200) {
					debug("_getMinMaxAvgSum", "Status code=", response.statusCode);
					return callback(null, null, response);
				}

				callback(null, body, response);
			});
		});
	}

	/**
	 *
	 * @param {string} path
	 * @param [*} options
	 * @param {function} callback
	 */
	getHistory(path, options, callback) {
		this._initializeMemcache((error, memcache) => {
			if (error) {
				return callback(error);
			}

			this._getHistory(path, options, memcache, callback);
		})
	}

	_getHistory(path, options, memcache, callback) {
		debug("_getHistory", "path=", path, "options=", options);

		this._getQueryURL(memcache, (error, queryURL) => {
			if (error) {
				return callback(error);
			}

			if (!queryURL) {
				return callback(new Error("No query URL"));
			}

			var options = {
				url: queryURL + '/history/' + path + '?' + stringify(options),
				json: true
			};

			debug("_getHistory", "send request to", options);

			request(options, (error, response, body) => {

				debug("_getHistory", "Request response error=", error, "body=", body);

				if (error) {
					return callback(error);
				}

				if (response.statusCode !== 200) {
					debug("_getMinMaxAvgSum", "Status code=", response.statusCode);
					return callback(null, null, response);
				}

				callback(null, body, response);
			});
		});
	}

	getCumulated(path, options, callback) {
		this._initializeMemcache((error, memcache) => {
			if (error) {
				return callback(error);
			}

			this._getCumulated(path, options, memcache, callback);
		})
	}

	_getCumulated(path, options, memcache, callback) {
		debug("_getCumulated", "path=", path, "options=", options);

		this._getQueryURL(memcache, (error, queryURL) => {
			if (error) {
				return callback(error);
			}

			if (!queryURL) {
				return callback(new Error("No query URL"));
			}

			var options = {
				url: queryURL + '/cumulated/' + path + '?' + stringify(options),
				json: true
			};

			debug("_getCumulated", "send request to", options);

			request(options, (error, response, body) => {

				debug("_getCumulated", "Request response error=", error, "body=", body);

				if (error) {
					return callback(error);
				}

				if (response.statusCode !== 200) {
					debug("_getCumulated", "Status code=", response.statusCode);
					return callback(null, null, response);
				}

				callback(null, body, response);
			});
		});
	}

	close(callback) {
		let memcache = this._memcache;
		if (!memcache) {
			return callback(null, false);
		}

		this._memcache = null;

		memcache.close((error) => {
			if (error) {
				debug("close", "error=", error);
				callback(error);
				return;
			}
			debug("close", "closed");
			callback(null, true);
		});
	}
}

function stringify(obj) {
	var o = Object.assign({}, obj);
	for (var k in o) {
		var v = o[k];
		if (v instanceof Date) {
			o[k] = v.toUTCString();
		}
	}

	var ret = Querystring.stringify(o);

	debug("stringify", "result=", ret);

	return ret;
}

module.exports = Query;