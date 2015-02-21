/**!
 * ali-oss - test/bucket.test.js
 *
 * Copyright(c) node-modules and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <m@fengmk2.com> (http://fengmk2.com)
 */

'use strict';

/**
 * Module dependencies.
 */

var assert = require('assert');
var utils = require('./utils');
var oss = require('../');
var config = require('./config');

describe('bucket.test.js', function () {
  var prefix = process.platform + '-' + process.version + '/';
  if (process.execPath.indexOf('iojs') >= 0) {
    prefix = 'iojs-' + prefix;
  }

  before(function* () {
    this.store = oss(config);
    this.bucket = 'ali-oss-global-test-bucket-' + prefix.replace(/[\/\.]/g, '-');
    this.bucket = this.bucket.substring(0, this.bucket.length - 1);
    this.region = 'oss-cn-hangzhou';
    if (process.env.TRAVIS || process.env.APPVEYOR) {
      this.region = 'oss-cn-hongkong';
    }
    var result = yield this.store.putBucket(this.bucket, this.region);
    assert.equal(result.bucket, this.bucket);
    assert.equal(result.res.status, 200);
  });

  after(function* () {
    var result = yield this.store.deleteBucket(this.bucket, this.region);
    assert(result.res.status === 200 || result.res.status === 204);
  });

  describe('putBucket()', function () {
    before(function () {
      this.buckets = [];
      var name = 'ali-oss-test-bucket-' + prefix.replace(/[\/\.]/g, '-');
      this.name = name.substring(0, name.length - 1);
    });

    it('should create a new bucket on HongKong region', function* () {
      var result = yield this.store.putBucket(this.name, 'oss-cn-hongkong');
      assert.equal(result.bucket, this.name);
      assert.equal(result.res.status, 200);
      this.buckets.push({
        name: this.name,
        region: 'oss-cn-hongkong'
      });

      // create a exists should work
      var result = yield this.store.putBucket(this.name, 'oss-cn-hongkong');
      assert.equal(result.res.status, 200);
      assert.equal(result.bucket, this.name);
    });

    it('should throw BucketAlreadyExistsError when change exists bucket region', function* () {
      yield utils.throws(function* () {
        yield this.store.putBucket(this.name, 'oss-cn-hangzhou');
      }.bind(this), function (err) {
        assert.equal(err.name, 'BucketAlreadyExistsError');
        assert.equal(err.message, 'Bucket already exists can\'t modify location.');
        assert.equal(err.status, 409);
      });
    });

    after(function* () {
      // clean up
      for (var i = 0; i < this.buckets.length; i++) {
        var info = this.buckets[i];
        var result = yield this.store.deleteBucket(info.name, info.region);
        assert(result.res.status === 200 || result.res.status === 204);
      }
    });
  });

  describe('deleteBucket()', function () {
    it('should delete not exists bucket throw NoSuchBucketError', function* () {
      yield utils.throws(function* () {
        yield this.store.deleteBucket('not-exists-bucket', 'oss-cn-hongkong');
      }.bind(this), 'NoSuchBucketError');
    });

    it('should delete not empty bucket throw BucketNotEmptyError', function* () {
      yield utils.throws(function* () {
        yield this.store.deleteBucket('node-ali-oss');
      }.bind(this), 'BucketNotEmptyError');
    });
  });

  describe('putBucketACL()', function () {
    it('should set public-read-write acl', function* () {
      var result = yield this.store.putBucketACL(this.bucket, this.region, 'public-read-write');
      assert.equal(result.res.status, 200);
      assert.equal(result.bucket, this.bucket);
      // again should work and dont change acl
      result = yield this.store.putBucketACL(this.bucket, this.region, 'public-read-write');
      assert.equal(result.res.status, 200);
      assert.equal(result.bucket, this.bucket);

      var r = yield this.store.getBucketACL(this.bucket, this.region);
      assert.equal(typeof r.acl, 'string');
      assert.equal(typeof r.owner.ID, 'string');
    });

    it('should set acl and region wrong will throw BucketAlreadyExistsError', function* () {
      yield utils.throws(function* () {
        yield this.store.putBucketACL(this.bucket, 'oss-cn-shenzhen', 'public-read');
      }.bind(this), function (err) {
        assert.equal(err.name, 'BucketAlreadyExistsError');
        assert.equal(err.message, 'Bucket already exists can\'t modify location.');
        assert.equal(err.status, 409);
      });
    });

    it('should create and set acl when bucket not exists', function* () {
      var bucket = this.bucket + '-new';
      var result = yield this.store.putBucketACL(bucket, this.region, 'public-read');
      assert.equal(result.res.status, 200);
      assert.equal(result.bucket, bucket);

      yield this.store.deleteBucket(bucket, this.region);
      // yield this.store.deleteBucket('ali-oss-global-test-bucket-iojs-darwin-v1-3-0not');
    });
  });

  describe('listBuckets()', function () {
    it('should list top 20 buckets', function* () {
      var result = yield this.store.listBuckets({
        "max-keys": 20
      });
      assert(Array.isArray(result.buckets));
      assert(result.buckets.length > 0);
      assert.equal(typeof result.buckets[0].Location, 'string');
      assert.equal(typeof result.buckets[0].Name, 'string');
      assert.equal(typeof result.buckets[0].CreationDate, 'string');

      assert(!result.isTruncated);
      assert.equal(result.nextMarker, null);
      assert(result.owner);
      assert.equal(typeof result.owner.ID, 'string');
      assert.equal(typeof result.owner.DisplayName, 'string');

      console.log(result.buckets);
    });
  });

  describe('putBucketLogging(), getBucketLogging(), deleteBucketLogging()', function () {
    it('should create, get and delete the logging', function* () {
      var result = yield this.store.putBucketLogging(this.bucket, this.region, 'logs/');
      assert.equal(result.res.status, 200);
      // put again will be fine
      var result = yield this.store.putBucketLogging(this.bucket, this.region, 'logs/');
      assert.equal(result.res.status, 200);

      // get the logging setttings
      var result = yield this.store.getBucketLogging(this.bucket, this.region);
      assert.equal(result.res.status, 200);

      // delete it
      var result = yield this.store.deleteBucketLogging(this.bucket, this.region);
      assert.equal(result.res.status, 204);
    });
  });

  describe('putBucketWebsite(), getBucketWebsite(), deleteBucketWebsite()', function () {
    it('should create, get and delete the website settings', function* () {
      var result = yield this.store.putBucketWebsite(this.bucket, this.region, {
        index: 'index.html'
      });
      assert.equal(result.res.status, 200);
      // put again will be fine
      var result = yield this.store.putBucketWebsite(this.bucket, this.region, {
        index: 'index.htm',
        error: 'error.htm'
      });
      assert.equal(result.res.status, 200);

      yield utils.sleep(2000);

      // get
      var result = yield this.store.getBucketWebsite(this.bucket, this.region);
      assert.equal(result.index, 'index.htm');
      assert.equal(result.error, 'error.htm');
      assert.equal(result.res.status, 200);

      // delete it
      var result = yield this.store.deleteBucketWebsite(this.bucket, this.region);
      assert.equal(result.res.status, 204);
    });
  });

  describe('putBucketLifecycle(), getBucketLifecycle(), deleteBucketLifecycle()', function () {
    it('should create, get and delete the lifecycle', function* () {
      var result = yield this.store.putBucketLifecycle(this.bucket, this.region, [{
        id: 'delete after one day',
        prefix: 'logs/',
        status: 'Enabled',
        days: 1
      }]);
      assert.equal(result.res.status, 200);

      // put again will be fine
      var result = yield this.store.putBucketLifecycle(this.bucket, this.region, [
        {
          id: 'delete after one day',
          prefix: 'logs/',
          status: 'Enabled',
          days: 1
        },
        {
          prefix: 'logs2/',
          status: 'Disabled',
          date: '2022-10-11T00:00:00.000Z'
        }
      ]);
      assert.equal(result.res.status, 200);

      yield utils.sleep(2000);

      // get
      var result = yield this.store.getBucketLifecycle(this.bucket, this.region);
      assert(result.rules.length > 0);
      assert.equal(result.res.status, 200);

      // delete it
      var result = yield this.store.deleteBucketLifecycle(this.bucket, this.region);
      assert.equal(result.res.status, 204);
    });
  });

  describe('putBucketReferer(), getBucketReferer(), deleteBucketReferer()', function () {
    it('should create, get and delete the referer', function* () {
      var result = yield this.store.putBucketReferer(this.bucket, this.region, true, [
        'http://npm.taobao.org'
      ]);
      assert.equal(result.res.status, 200);

      // put again will be fine
      var referers = [
        'http://npm.taobao.org',
        'https://npm.taobao.org',
        'http://cnpmjs.org'
      ];
      var result = yield this.store.putBucketReferer(this.bucket, this.region, false, referers);
      assert.equal(result.res.status, 200);

      yield utils.sleep(2000);

      // get
      var result = yield this.store.getBucketReferer(this.bucket, this.region);
      assert(Array.isArray(result.referers));
      assert.equal(typeof result.allowEmpty, 'boolean');
      assert.equal(result.res.status, 200);

      // delete it
      var result = yield this.store.deleteBucketReferer(this.bucket, this.region);
      assert.equal(result.res.status, 200);
    });
  });
});
