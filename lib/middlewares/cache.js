// jshint esnext: true

var path = require('path');
var url = require('url');
var co = require('co');
var fs = require('../utils/fs');
var ao = require('../utils/ao');

module.exports = function (options) {
  'use strict';

  options = ao.defaults(options, {
    cacheDir: './cache'
  });

  var cachePath = function(ctx) {
    var parsed = url.parse(ctx.url);

    return path.join(options.cacheDir, parsed.hostname + (parsed.port ? '.' + parsed.port : '') + parsed.path);
    // return path.join(cacheDir, resourceUrl.replace(/(:\/\/|:)/g, '.'));
  };

  var read = function(ctx) {
    return co(function *() {
      try {
        var cacheFile = cachePath(ctx);
        var data = yield {
          body: fs.readFile(cacheFile),
          meta: fs.readFile(cacheFile + '.metadata'),
        };

        var result = JSON.parse(data.meta);
        result.body = data.body;
        return result;
      } catch(e) {
      }
    });
  };

  var write = function(ctx) {
    return co(function *() {
      var cacheFile = cachePath(ctx);
      yield fs.mkdir(path.dirname(cacheFile));
      yield [
        fs.writeFile(cacheFile, ctx.body),
        fs.writeFile(cacheFile + '.metadata', JSON.stringify(ctx.response)),
      ];
    });
  };

  var apply = function(ctx, cache) {
    ctx.status = cache.status;
    ctx.set(cache.header);
    ctx.body = cache.body;
  };

  return function *(next) {
    var cache = yield read(this);
    if (cache) {
      apply(this, cache);
    } else {
      yield next;

      if (this.status) {
        yield write(this);
      }
    }
  };
};