const AWS = require('aws-sdk');
const config = require('config');

const {
  accessKeyId,
  secretAccessKey,
  region,
  endpoint,
  s3ForcePathStyle,
} = config.get('aws');

const s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  accessKeyId,
  secretAccessKey,
  region,
  endpoint,
  s3ForcePathStyle,
});
let thisBucket = null;

/**
 * @summary Set the bucket to be used for subsequent function calls.
 * @function
 */
const setBucket = (bucket) => {
  thisBucket = bucket;
};

/**
 * @summary Checks if a bucket exists
 * @function
 * @param bucket The bucket to be checked
 * @returns {Promise} Promise object represents a boolean indicating if the bucket exists or not
 */
const bucketExists = (bucket = thisBucket) => new Promise((resolve, reject) => {
  const params = { Bucket: bucket };
  s3.headBucket(params).promise().then(() => {
    resolve(true);
  }).catch((err) => {
    if (err.code === 'NotFound') {
      resolve(false);
    } else {
      reject(err);
    }
  });
});

/**
 * @summary Checks if an object exists in a bucket
 * @function
 * @param key The key of the object to be checked
 * @param bucket The bucket where the key will be searched
 * @returns {Promise} Promise object represents a boolean indicating if the key exists or not
 */
const objectExists = (key, bucket = thisBucket) => new Promise((resolve, reject) => {
  const params = { Bucket: bucket, Key: key };
  s3.headObject(params).promise().then(() => {
    resolve(true);
  }).catch((err) => {
    if (err.code === 'NotFound') {
      resolve(false);
    } else {
      reject(err);
    }
  });
});

/**
 * @summary List objects in a bucket
 * @function
 * @param params Additional params to be used in the search
 * @param bucket The bucket to search for objects
 * @returns {Promise} Promise object representing the objects
 */
const listObjects = (params = {}, bucket = thisBucket) => {
  const newParams = Object.assign(params, { Bucket: bucket });
  return s3.listObjectsV2(newParams).promise();
};

/**
 * @summary Gets an object from a bucket
 * @function
 * @param key The key of the object
 * @param bucket The bucket where the object exists
 * @returns {Promise} Promise object representing the object response
 */
const getObject = (key, bucket = thisBucket) => {
  const params = { Bucket: bucket, Key: key };
  return s3.getObject(params).promise();
};

module.exports = {
  setBucket,
  bucketExists,
  objectExists,
  listObjects,
  getObject,
};
