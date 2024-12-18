'use strict';

const request = require('postman-request');
const fp = require('lodash/fp');
const async = require('async');
const config = require('./config/config');
const fs = require('fs');

let log = null;
let requestWithDefaults;
const MAX_PARALLEL_LOOKUPS = 5;

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
  log.trace({ entities }, 'Checking to see if data is moving');

  const tasks = fp.map(
    (entityObj) => (next) =>
      _lookupEntity(entityObj, options, function (err, result) {
        if (err) {
          next(err);
        } else {
          log.trace({ result }, 'Checking Results');
          next(null, result);
        }
      }),
    entities
  );

  async.parallelLimit(tasks, MAX_PARALLEL_LOOKUPS, (err, lookupResults) => {
    if (err) {
      log.error(err, 'Error running lookup');
      return cb(err);
    }

    log.trace({ lookupResults }, 'Lookup Results');
    cb(null, lookupResults);
  });
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

  if (options.spaceKeys) {
    keys = fp.flow(fp.get('spaceKeys'), fp.split(','), fp.map(fp.trim))(options);
  }

  let keyString = '';
  if (keys.length > 0) {
    keyString = ` and space.key IN (${keys.join(',')}) `;
  }

  let searchLocation = options.searchTitlesOnly ? 'title' : 'text';

  let query = `${searchLocation}~'${
    !options.reduceFuzziness
      ? fp.flow(fp.split(/[^\w]/g), fp.compact, fp.join(' '))(entityObj.value)
      : `"${entityObj.value}"~-0.5`
  }' ${keyString} and type IN (${types.join(',')}) order by lastmodified desc`;

  return query;
}

const handleRestError = (response, options, requestOptions, error) => {
  if (error) {
    return {
      detail: 'Network error encountered',
      error
    };
  }

  const sanitizedOptions = sanitizeRequestOptions(requestOptions);

  if (response.statusCode === 403) {
    return {
      baseUrl: options.baseUrl,
      detail: 'Forbidden, the requested action is forbidden for the provided authentication credentials.',
      statusCode: response.statusCode,
      requestOptions: sanitizedOptions
    };
  }

  if (response.statusCode === 400) {
    return {
      baseUrl: options.baseUrl,
      detail: 'Bad Request, Check your CQL Query, Or your Confluence API URL.',
      statusCode: response.statusCode,
      requestOptions: sanitizedOptions
    };
  }

  if (response.statusCode === 401) {
    return {
      baseUrl: options.baseUrl,
      detail: 'Authentication Error, check your API Key Or your Confluence API URL.',
      statusCode: response.statusCode,
      requestOptions: sanitizedOptions
    };
  }

  if (response.statusCode === 404) {
    return {
      baseUrl: options.baseUrl,
      detail: 'Not Found, Check your Confluence API URL.',
      statusCode: response.statusCode,
      requestOptions: sanitizedOptions
    };
  }

  if (response.statusCode === 500) {
    return {
      baseUrl: options.baseUrl,
      detail: 'Unexpected Confluence API Error.',
      statusCode: response.statusCode,
      requestOptions: sanitizedOptions
    };
  }
};

const sanitizeRequestOptions = (requestOptions) => {
  if (requestOptions && requestOptions.auth && requestOptions.password) {
    requestOptions.auth.password = '********';
  }

  if (requestOptions && requestOptions.headers && requestOptions.headers.Authorization) {
    requestOptions.headers.Authorization = `Bearer *********`;
  }

  return requestOptions;
};

function _lookupEntity(entityObj, options, cb) {
  let blogData = [];
  let attachments = [];
  let pageData = [];
  let spaceData = [];

  let appUrl = options.appUrl.length > 0 ? options.appUrl : options.baseUrl;
  options.baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl.slice(0, -1) : options.baseUrl;
  let uri = `${options.baseUrl}/rest/api/search`;
  let url = options.baseUrl;
  const cql = _createQuery(entityObj, options);

  let requestOptions = {
    uri,
    method: 'GET',
    qs: {
      cql
    },
    json: true
  };

  if (options.confluenceType.value === 'cloud') {
    requestOptions.auth = {
      username: options.userName,
      password: options.apiKey
    };
  } else {
    requestOptions.headers = {
      Authorization: `Bearer ${options.apiKey}`
    };
  }

  log.trace({ cql }, 'CQL Request Parameter');

  requestWithDefaults(requestOptions, function (error, response, body) {
    log.trace({ response }, 'Response from Confluence');
    const restErr = handleRestError(response, options, requestOptions, error);

    if (restErr) {
      return cb(restErr);
    }

    // 200
    if (response.statusCode !== 200) {
      cb({
        detail: 'Unexpected HTTP Status Code Received',
        statusCode: response.statusCode,
        debug: body
      });
      return;
    }

    if (fp.isNull(body) || fp.isEmpty(body.results)) {
      cb(null, {
        entity: entityObj,
        data: null // setting data to null indicates to the server that this entity lookup was a "miss"
      });
      return;
    }

    if (fp.find('user', body.results)) {
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
        summary: getSummaryTags(spaceData, pageData, blogData, attachments, options),
        // Data that you want to pass back to the notification window details block
        details: {
          appUrl: appUrl,
          space: spaceData,
          page: pageData,
          blog: blogData,
          attachments: attachments,
          totalSize: body.totalSize,
          size: body.size,
          searchLink: getSearchLink(appUrl, cql, options),
          searchTypesString: getSearchTypesString(options)
        }
      }
    });
  });
}

function getSearchLink(appUrl, cql, options){
  if(options.confluenceType.value === 'cloud'){
    return `${appUrl}/search?text=${cql}`;  
  } else {
    return `${appUrl}/dosearchsite.action?cql=${cql}`;
  }  
}

function getSearchTypesString(options) {
  const types = [];
  if (options.searchPage) {
    types.push('pages');
  }

  if (options.searchBlog) {
    types.push('blogs');
  }

  if (options.searchAttachments) {
    types.push('attachments');
  }

  if (options.searchSpace) {
    types.push('spaces');
  }

  if (types.length > 1) {
    const front = types.slice(0, types.length - 1);
    const end = types[types.length - 1];
    front.push(`and ${end}`);
    return front.join(', ');
  } else {
    // Only one type
    return types[0];
  }
}

function getSummaryTags(spaceData, pageData, blogData, attachments, options) {
  const tags = [];

  if (options.searchPage) {
    tags.push(`Pages: ${pageData.length}`);
  }

  if (options.searchBlog) {
    tags.push(`Blogs: ${blogData.length}`);
  }

  if (options.searchAttachments) {
    tags.push(`Attachments: ${attachments.length}`);
  }

  if (options.searchSpace) {
    tags.push(`Spaces: ${spaceData.length}`);
  }

  return tags;
}

function validateOptions(userOptions, cb) {
  let errors = [];
  log.info({ userOptions }, 'validateOptions');
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
    userOptions.confluenceType.value.value === 'cloud' &&
    typeof userOptions.userName.value === 'string' &&
    userOptions.userName.value.length === 0
  ) {
    errors.push({
      key: 'userName',
      message: 'You must provide an account email address for Confluence Cloud authentication'
    });
  }

  if (
    userOptions.confluenceType.value.value === 'server' &&
    typeof userOptions.userName.value === 'string' &&
    userOptions.userName.value.length > 0
  ) {
    errors.push({
      key: 'userName',
      message: 'Account Email should not be provided for Confluence Server authentication.  Only enter an API Token.'
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
