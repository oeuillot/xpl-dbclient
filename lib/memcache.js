/*jslint node: true, vars: true, nomen: true, esversion: 6 */
'use strict';

const Memcache = require('memcache');
const debug = require('debug')('xpl-dbclient:memcache');

const KEY_PREFIX = "xpl:";

const NUMBER_UNITS = ["c", "%", "mm"];

const TRUE_CURRENT = /(on|enable|true)/i;

const FALSE_CURRENT = /(off|disable|false)/i;

const DEFAULT_LIFETIME = 60 * 15;
const REST_SERVER_URL_LIFETIME = 60;

class XplMemcache {
	constructor(configuration, deviceAliases) {
		configuration = configuration || {};

		this._deviceAliases = deviceAliases;
		this._configuration = configuration;

		this._keyPrefix = configuration.memcacheKeyPrefix || KEY_PREFIX;

		this._lifetime = configuration.lifetime;
		if (typeof(this._lifetime) !== "number") {
			this._lifetime = DEFAULT_LIFETIME;
		}
	}

	static fillCommander(commander) {
		commander.option("--memcacheHost <host>", "Memcache host name");
		commander.option("--memcachePort <port>", "Memcache port", parseInt);
		commander.option("--memcacheKeyPrefix <port>", "Memcache key prefix");
	}

	initialize(callback) {
		var configuration = this._configuration;

		var client = new Memcache.Client(configuration.memcachePort, configuration.memcacheHost);

		var connecting = true;
		client.on('connect', (error) => {
			if (!connecting) {
				return;
			}
			connecting = false;

			if (error) {
				console.error("Connect error", error);
				return callback(error);
			}
			debug("initialize", "Memcache connected");

			this._memcacheClient = client;

			callback();
		});

		client.on('error', (error) => {
			console.error("Memcache error", error);

			if (!connecting) {
				return;
			}
			connecting = false;
			callback(error);
		});

		client.on('close', () => {
			debug("initialize", "Memcache closed");

			this._memcacheClient = null;
		});
		client.on('timeout', () => {
			console.error("Memcache timeout");
		});

		client.connect();
	}

	getCurrent(path, callback) {
		if (!this._memcacheClient) {
			return callback(new Error("No memcache client"));
		}

		var key = this._keyPrefix + path.replace(/[\s]/g, '_');
		debug("getCurrent", "Search path=", path, "key=", key);

		this._memcacheClient.get(key, (error, result) => {
			if (error) {
				console.error(error);
				return callback(error);
			}
			if (!result) {
				return callback();
			}

			var obj = JSON.parse(result);

			if (obj && (typeof(obj.date) === "string" || typeof(obj.date) === "number")) {
				obj.date = new Date(obj.date);
			}

			debug("getCurrent", "Get", path, "return =>", obj);

			callback(null, obj);
		});
	}

	saveMessage(message) {
		if (message.headerName !== "xpl-trig" && message.headerName !== "xpl-stat") {
			return false;
		}
		/*
		 if (message.bodyName !== "sensor.basic") {
		 return false;
		 }*/

		var current = message.body.current;
		if (current === undefined || current === null) {
			current = message.body.command;
			if (current === undefined || current === null) {
				return false;
			}
		}

		var deviceName = message.body.device;
		var path = deviceName || message.body.address;
		if (!path) {
			return false;
		}

		if (this._deviceAliases && this._deviceAliases[path]) {
			path = this._deviceAliases[path];
			if (!path) {
				return false;
			}
		}

		var type = message.body.type;
		if (type) {
			path += "/" + type;

			if (this._deviceAliases && this._deviceAliases[path]) {
				path = this._deviceAliases[path];
				if (!path) {
					return false;
				}
			}
		}

		if (typeof(current) === "string") {
			var currentLC = current.toLowerCase();

			if (NUMBER_UNITS[message.body.units || ''] ||
				/^(-?[0-9]+)(\.[0-9])?$/.exec(current)) {
				current = parseFloat(current);

			} else if (TRUE_CURRENT.exec(currentLC)) {
				current = true;

			} else if (FALSE_CURRENT.exec(currentLC)) {
				current = false;
			}
		}

		var d = message.body.date && new Date(message.body.date);
		if (!d) {
			d = new Date();
		}

		var v = {
			date: d,
			current: current
		};

		if (message.body.units) {
			v.units = message.body.units;
		}

		// console.log("Save memcache", key, " value=", v);

		setTimeout(() => {
			if (!this._memcacheClient) {
				console.error("No memcache !");
				return;
			}

			this.saveCurrent(path, v, (error) => {
				if (error) {
					console.error("SET-ERROR '" + path + "' (" + v + ")", error);
				}
			});
		}, 100);

		return true;
	}

	saveCurrent(key, value, callback) {

		debug("saveCurrent", "Set memcache key=", key, "value=", value);

		let v = JSON.stringify(value);
		let k = this._keyPrefix + key.replace(/[\s]/g, '_');

		this._memcacheClient.set(k, v, this._lifetime, (error, result) => {

			callback(error);
		});
	}

	saveRestServerURL(url, callback) {
		if (!this._memcacheClient) {
			return callback(new Error("No memcache client"));
		}

		debug("saveRestServerURL", "Set REST server url to ", url);

		this._memcacheClient.set(this._keyPrefix + "@@REST_SERVER_URL", url, REST_SERVER_URL_LIFETIME, callback);
	}

	getRestServerURL(callback) {
		if (!this._memcacheClient) {
			return callback(new Error("No memcache client"));
		}

		this._memcacheClient.get(this._keyPrefix + "@@REST_SERVER_URL", (error, url) => {
			debug("getRestServerURL", "Get REST server url=>", url, "error=", error);

			callback(error, url);
		});
	}

	close(callback) {
		if (!callback) {
			callback = ()=> {
			};
		}
		if (!this._memcacheClient) {
			return callback();
		}

		this._memcacheClient.close();
		this._memcacheClient = null;
		callback();
	}
}

module.exports = XplMemcache;