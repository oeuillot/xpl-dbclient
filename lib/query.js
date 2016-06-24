/*jslint node: true, vars: true, nomen: true, esversion: 6 */
'use strict';

const debug = require('debug')('xpl-dbclient:query');
const Memcache = require('./memcache');
const request = require('request');
const Semaphore = require('semaphore');
const Querystring = require('querystring');

class Query {

  constructor(configuration) {
    this._configuration=configuration || {};

    this._semaphore=Semaphore(1);
  }

  static fillCommander(commander) {
    commander.option("--queryServer <url>", "Query server URL");

    Memcache.fillCommander(commander);
  }

  _initializeMemcache(callback) {
    if (this._memcache) {
      return callback();
    }

    var semaphore=this._semaphore;

    semaphore.take(() => {
      if (this._memcache) {
        semaphore.leave();

        return callback(null, this._queryURL);
      }

      var conf=Object.assign({}, this._configuration);

      debug("_initializeMemcache", "Initialize memcache ...", conf);

      var memcache=new Memcache(conf);

      memcache.initialize((error) => {
        debug("_initializeMemcache", "Memcache initialization returns", error);
        if (error) {
          semaphore.leave();

          return callback(error);
        }

        if (this._configuration.queryServer) {
          this._queryURL = this._configuration.queryServer;

          debug("_initializeMemcache", "Force queryURL to",this._queryURL);

          this._memcache=memcache;
          semaphore.leave();
          return callback(null, this._queryURL);
        }

        memcache.getRestServerURL((error, url) => {

          if (error) {
            debug("_initializeMemcache", "Memcache queryURL error=",error);

            console.error(error);

          } else {
            debug("_initializeMemcache", "Memcache queryURL url=",url);
          }

          this._queryURL = url;

          this._memcache=memcache;
          semaphore.leave();

          callback(null, url);
        });
      });
    });
  }

  getValue(path, callback) {
    getLast(path, callback);
  }

  getLast(path, callback) {
    this._initializeMemcache((error, serverURL) => {
      if (error) {
        return callback(error);
      }

      this._getLast(path, serverURL, callback);
    })
  }

  _getLast(path, queryURL, callback) {
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

      if (!queryURL) {
        return callback(error);
      }

      var options = {
          url: queryURL+'/last/'+path,
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
  
  getMinMaxAvgSum(path, options, callback) {
    this._initializeMemcache((error, serverURL) => {
      if (error) {
        return callback(error);
      }

      this._getMinMaxAvgSum(path, options, serverURL, callback);
    })
  }

  _getMinMaxAvgSum(path, options, queryURL, callback) {
    debug("_getMinMaxAvgSum", "path=",path,"options=",options);

    if (!queryURL) {
      return callback(error);
    }

    var options = {
        url: queryURL+'/minMaxAvgSum/'+path+'?'+Querystring.stringify(options),
        json: true
    };

    debug("_getMinMaxAvgSum", "send request to",options);

    request(options, (error, response, body) => {

      debug("_getMinMaxAvgSum", "Request response error=",error,"body=",body);

      if (error) {
        return callback(error);
      }

      if (response.statusCode!==200) {
        debug("_getMinMaxAvgSum", "Status code=",response.statusCode);
        return callback(null, null, response);
      }

      callback(null, body, response);
    });
  }


  getHistory(path, options, callback) {
    this._initializeMemcache((error, serverURL) => {
      if (error) {
        return callback(error);
      }

      this._getHistory(path, options, serverURL, callback);
    })
  }

  _getHistory(path, options, queryURL, callback) {
    debug("_getHistory", "path=",path,"options=",options);

    if (!queryURL) {
      return callback(error);
    }

    var options = {
        url: queryURL+'/history/'+path+'?'+Querystring.stringify(options),
        json: true
    };

    debug("_getHistory", "send request to",options);

    request(options, (error, response, body) => {

      debug("_getHistory", "Request response error=",error,"body=",body);

      if (error) {
        return callback(error);
      }

      if (response.statusCode!==200) {
        debug("_getMinMaxAvgSum", "Status code=",response.statusCode);
        return callback(null, null, response);
      }

      callback(null, body, response);
    });
  }

  getCumulated(path, options, callback) {
    this._initializeMemcache((error, serverURL) => {
      if (error) {
        return callback(error);
      }

      this._getCumulated(path, options, serverURL, callback);
    })
  }

  _getCumulated(path, options, queryURL, callback) {
    debug("_getCumulated", "path=",path,"options=",options);

    if (!queryURL) {
      return callback(error);
    }

    var options = {
        url: queryURL+'/cumulated/'+path+'?'+Querystring.stringify(options),
        json: true
    };

    debug("_getCumulated", "send request to",options);

    request(options, (error, response, body) => {

      debug("_getCumulated", "Request response error=",error,"body=",body);

      if (error) {
        return callback(error);
      }

      if (response.statusCode!==200) {
        debug("_getCumulated", "Status code=",response.statusCode);
        return callback(null, null, response);
      }

      callback(null, body, response);
    });
  }

  close(callback) {
    if (!this._memcache) {
      return callback(null, false);
    }
    
    this._memcache.close((error) => {
      this._memcache=null;
      
      debug("close error=",error);
      
      callback(null, true, error);
    });
  }
}

module.exports = Query;