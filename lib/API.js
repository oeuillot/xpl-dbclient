/*jslint node: true, vars: true, nomen: true, esversion: 6 */
'use strict';

const Query = require('./query');
const Memcache = require('./memcache');

module.exports = {
	Query: Query,
	Memcache: Memcache
};