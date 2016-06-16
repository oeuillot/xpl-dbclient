/*jslint node: true, vars: true, nomen: true, esversion: 6 */
'use strict';

const commander = require('commander');
const debug = require('debug')('xpl-dbclient');

const XplDBClient = require('./lib/API');
const Memcache = XplDBClient.Memcache;
const Query = XplDBClient.Query;

commander.version(require("./package.json").version);

Memcache.fillCommander(commander);

commander.command("request").action((path) => {
  var query=new Query(commander);
  
  query.getValue(path, (error, value) => {
    if (error) {
      console.error(error);
      return;
    }
    
    console.log(value);
    
    query.close();
  });
  
});

commander.parse(process.argv);
