'use strict';
let request = require('request');
let _ = require('lodash');
let async = require('async');
let util = require('util');
let log = null

function startup(logger) {
  log = logger;
}

function doLookup(entities, options, cb) {
  let lookupResults = [];

  log.trace({
    entity: entities
  }, "Checking to see if data is moving");

  async.each(entities, function(entityObj, next) {
    _lookupEntity(entityObj, options, function(err, result) {
      if (err) {
        next(err);
      } else {
        lookupResults.push(result);

        log.trace({
          result: result
        }, "Checking Results");
        next(null);
      }
    });
  }, function(err) {
    cb(err, lookupResults);
  });
}

function _lookupEntity(entityObj, options, cb) {
  log.trace({
    entity: entityObj
  }, "Checking to see if data is moving");

  let uri = options.baseUrl + "/rest/api/search?cql=siteSearch~\"" + entityObj.value + "\"";
  let url = options.baseUrl;
  request({
    uri: uri,
    method: 'GET',
    auth: {
      'username': options.userName,
      'password': options.apiKey
    },
    json: true

  }, function(err, response, body) {
    // check for a request error
    if (err) {
      cb({
        detail: 'Error Making HTTP Request',
        debug: err
      });
      return;
    }


    // If we get a 404 then cache a miss
    if (response.statusCode === 404) {
      cb(null, {
        entity: entityObj,
        data: null // setting data to null indicates to the server that this entity lookup was a "miss"
      });
      return;
    }

    if (response.statusCode !== 200) {
      cb({
        detail: 'Unexpected HTTP Status Code Received',
        debug: body
      });
      return;
    }

    log.debug({body: body}, "Checking Null results for body");

    if (_.isNull(body) || _.isEmpty(body.results)){
      cb(null, {
        entity: entityObj,
        data: null // setting data to null indicates to the server that this entity lookup was a "miss"
      });
      return;
    }


    if (options.searchSpace) {
      var spaceData = body.results.filter(function (item){
        if(item != null){
          return item.space
        }
      });
    }

    if (options.searchPage) {
      var pageData = body.results.filter(function (item){
        if(item.content != null){
          return item.content.type === "page"
        }

      });
    }

    if (options.searchBlog) {
      var blogData = body.results.filter(function (item){
        if(item.content != null){
          return item.content.type === "blogpost"
        }
      });
    }


    // The lookup results returned is an array of lookup objects with the following format
    cb(null, {
      // Required: This is the entity object passed into the integration doLookup method
      entity: entityObj,
      // Required: An object containing everything you want passed to the template
      data: {
        // Required: These are the tags that are displayed in your template
        summary: [],
        // Data that you want to pass back to the notification window details block
        details: {
          url: url,
          space: spaceData,
          page: pageData,
          blog: blogData
        }
      }
    });
  });
}

module.exports = {
  doLookup: doLookup,
  startup: startup
};
