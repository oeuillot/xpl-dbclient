/*jslint node: true, vars: true, nomen: true, esversion: 6 */
'use strict';

const debug = require('debug')('xpl-dbclient:query');
const Memcache = require('./memcache');
const request = require('request');
const Semaphore = require('semaphore');

class Query {

  constructor(configuration) {
    this._configuration=configuration || {};
    
    this._semaphore=Semaphore(1);
  }

  static fillCommander(commander) {
    commander.option("--queryServer <url>", "Query server URL");

    Memcache.fillCommander(commander);
  }

  getValue(path, callback) {
    if (this._memcache) {
      return this._getValue(path, callback);
    }

    var semaphore=this._semaphore;
    
    semaphore.take(() => {
      if (this._memcache) {
        semaphore.leave();
        
        return this._getValue(path, callback);
      }

      var conf=Object.assign({}, this._configuration);

      debug("getValue", "Initialize memcache ...", conf);

      var memcache=new Memcache(conf);

      memcache.initialize((error) => {
        debug("getValue", "Memcache initialization returns", error);
        if (error) {
          semaphore.leave();
          
          return callback(error);
        }


        if (this._configuration.queryServer) {
          this._queryURL = this._configuration.queryServer;

          debug("getValue", "Force queryURL to",this._queryURL);

          this._memcache=memcache;
          semaphore.leave();
          return this._getValue(path, callback);
        }

        memcache.getRestServerURL((error, url) => {

          debug("getValue", "Memcache queryURL url=",url,"error=",error);

          if (error) {
            console.error(error);
          }

          this._queryURL = url;

          this._memcache=memcache;
          semaphore.leave();

          this._getValue(path, callback);
        });
      });
    });
  }

  _getValue(path, callback) {
    debug("_getValue", "path=",path);

    this._memcache.getCurrent(path, (error, value) => {
      debug("_getValue", "memcache returns value=",value,"error=",error);

      if (!error) {
        if (value) {
          return callback(null, value);
        }
        if (value==="") {
          return callback(null, null);
        }
      }

      if (error) {
        console.error(error);
      }

      if (!this._queryURL) {
        return callback(error);
      }

      var options = {
          url: this._queryURL+'/last/'+path,
          json: true
      };

      debug("_getValue", "send request to",options);

      request(options, (error, response, body) => {

        debug("_getValue", "Request response error=",error,"body=",body);

        if (error) {
          return callback(error);
        }

        if (response.statusCode!==200) {
          debug("_getValue", "Status code=",response.statusCode);
          return callback(null, null);
        }

        if (body && typeof(body.date)==="string") {
          body.date=new Date(body.date);
        }

        callback(null, body);
      });
    });
  }

  close(callback) {
    this._memcache.close(callback);
  }
}

module.exports = Query;