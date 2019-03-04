const appRoot = require('app-root-path');
const config = require('config');

const { setBucket, bucketExists } = appRoot.require('api/v1/db/aws/aws-operations');
const { validateDBPath } = appRoot.require('api/v1/db/json/fs-operations');

const { dataSource } = config.get('api');

/**
 * @summary Validate database configuration
 * @function
 */
const validateDataSource = async () => {
  try {
    if (dataSource === 'aws') {
      const { awsBucket } = config.get('api');
      if (!(await bucketExists(awsBucket))) {
        console.error('Error: AWS bucket does not exist');
        process.exit(1);
      } else {
        setBucket(awsBucket);
      }
    } else if (dataSource === 'local') {
      const { dbDirectoryPath } = config.get('api');
      await validateDBPath(dbDirectoryPath);
    } else {
      console.error('Error: invalid option for api.dataSource. Valid options are "aws" and "local"');
      process.exit(1);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = { validateDataSource };
