'use strict';

const request = require('request');
const _ = require('lodash');
const async = require('async');
const config = require('./config/config');

let log = null;
let requestWithDefaults;

function startup(logger) {
  log = logger;

  let defaults = {};

  if (typeof config.request.cert === 'string' && config.request.cert.length > 0) {
    defaults.cert = fs.readFileSync(config.request.cert);
  }

  if (typeof config.request.key === 'string' && config.request.key.length > 0) {
    defaults.key = fs.readFileSync(config.request.key);
  }

  if (typeof config.request.passphrase === 'string' && config.request.passphrase.length > 0) {
    defaults.passphrase = config.request.passphrase;
  }

  if (typeof config.request.ca === 'string' && config.request.ca.length > 0) {
    defaults.ca = fs.readFileSync(config.request.ca);
  }

  if (typeof config.request.proxy === 'string' && config.request.proxy.length > 0) {
    defaults.proxy = config.request.proxy;
  }

  if (typeof config.request.rejectUnauthorized === 'boolean') {
    defaults.rejectUnauthorized = config.request.rejectUnauthorized;
  }

  requestWithDefaults = request.defaults(defaults);
}


function doLookup(entities, options, cb) {
  let lookupResults = [];

  log.trace(
    {
      entity: entities
    },
    'Checking to see if data is moving'
  );

  async.each(
    entities,
    function(entityObj, next) {
      _lookupEntity(entityObj, options, function(err, result) {
        if (err) {
          next(err);
        } else {
          lookupResults.push(result);

          log.trace(
            {
              result: result
            },
            'Checking Results'
          );
          next(null);
        }
      });
    },
    function(err) {
      cb(err, lookupResults);
    }
  );
}

function _createQuery(entityObj, options) {
  let types = [];
  let keys = [];

  if (options.searchAttachments) {
    types.push('attachment');
  }

  if (options.searchBlog) {
    types.push('blogpost');
  }

  if (options.searchPage) {
    types.push('page');
  }

  if (options.searchSpace) {
    types.push('space');
  }

  if(options.spaceKeys){
    keys = options.spaceKeys.split(',').map(key => {
      return key.trim();
    })
  }

  let keyString = '';
  if(keys.length > 0){
    keyString = ` and space.key IN (${keys.join(',')}) `;
  }

  let query = `text~'"${entityObj.value}"${
    options.reduceFuzziness ? '~-0.5' : ''
  }' ${keyString} and type IN (${types.join(',')}) order by lastmodified desc`;

  return query;
}

function _lookupEntity(entityObj, options, cb) {
  let blogData = [];
  let attachments = [];
  let pageData = [];
  let spaceData = [];

  let uri = `${options.baseUrl}/rest/api/search`;
  let url = options.baseUrl;
  const cql = _createQuery(entityObj, options)

  let requestOptions = {
    uri: uri,
    method: 'GET',
    qs: {
      cql
    },
    auth: {
      username: options.userName,
      password: options.apiKey
    },
    json: true
  };

  log.trace({ cql }, 'CQL Request Parameter');

  requestWithDefaults(requestOptions, function (err, response, body) {
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

    if (response.statusCode === 400) {
      cb(null, {
        entity: entityObj,
        data: null // setting data to null indicates to the server that this entity lookup was a "miss"
      });
      return;
    }

    if (response.statusCode !== 200) {
      cb({
        detail: 'Unexpected HTTP Status Code Received',
        statusCode: response.statusCode,
        debug: body
      });
      return;
    }

    if (_.isNull(body) || _.isEmpty(body.results)) {
      cb(null, {
        entity: entityObj,
        data: null // setting data to null indicates to the server that this entity lookup was a "miss"
      });
      return;
    }

    if (_.find(body.results, 'user')) {
      cb(null, {
        entity: entityObj,
        data: null // setting data to null indicates to the server that this entity lookup was a "miss"
      });
      return;
    }

    if (options.searchSpace) {
      spaceData = body.results.filter(function (item) {
        if (item != null) {
          return item.space;
        }
      });
    }

    if (options.searchPage) {
      pageData = body.results.filter(function (item) {
        if (item.content != null) {
          return item.content.type === 'page';
        }
      });
    }

    if (options.searchBlog) {
      blogData = body.results.filter(function (item) {
        if (item.content != null) {
          return item.content.type === 'blogpost';
        }
      });
    }

    if (options.searchAttachments) {
      attachments = body.results.filter(function (item) {
        if (item.content != null) {
          return item.content.type === 'attachment';
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
        summary: [
          `Spaces: ${spaceData.length}`,
          `Pages: ${pageData.length}`,
          `Blogs: ${blogData.length}`,
          `Attachments: ${attachments.length}`
        ],
        // Data that you want to pass back to the notification window details block
        details: {
          url: url,
          space: spaceData,
          page: pageData,
          blog: blogData,
          attachments: attachments,
          totalSize: body.totalSize,
          size: body.size
        }
      }
    });
  });
}

function validateOptions(userOptions, cb) {
  let errors = [];

  if (
    typeof userOptions.baseUrl.value !== 'string' ||
    (typeof userOptions.baseUrl.value === 'string' && userOptions.baseUrl.value.length === 0)
  ) {
    errors.push({
      key: 'baseUrl',
      message: 'You must provide a base URL'
    });
  }

  if (
    typeof userOptions.userName.value !== 'string' ||
    (typeof userOptions.userName.value === 'string' && userOptions.userName.value.length === 0)
  ) {
    errors.push({
      key: 'userName',
      message: 'You must provide an account email address'
    });
  }

  if (
    typeof userOptions.apiKey.value !== 'string' ||
    (typeof userOptions.apiKey.value === 'string' && userOptions.apiKey.value.length === 0)
  ) {
    errors.push({
      key: 'apiKey',
      message: 'You must provide an API token'
    });
  }

  if (
    !userOptions.searchSpace.value &&
    !userOptions.searchPage.value &&
    !userOptions.searchBlog.value &&
    !userOptions.searchAttachments.value
  ) {
    errors.push({
      key: 'searchSpace',
      message: 'You must select at least one location to search out of Spaces, Pages, Blogs, and Attachments.'
    });
    errors.push({
      key: 'searchPage',
      message: 'You must select at least one location to search out of Spaces, Pages, Blogs, and Attachments.'
    });
    errors.push({
      key: 'searchBlog',
      message: 'You must select at least one location to search out of Spaces, Pages, Blogs, and Attachments.'
    });
    errors.push({
      key: 'searchAttachments',
      message: 'You must select at least one location to search out of Spaces, Pages, Blogs, and Attachments.'
    });
  }

  cb(null, errors);
}

module.exports = {
  doLookup: doLookup,
  startup: startup,
  validateOptions: validateOptions
};
