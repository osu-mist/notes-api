const appRoot = require('app-root-path');
const config = require('config');

const { validateDBPath } = require('./fs-operations');

const { setBucket, bucketExists } = appRoot.require('utils/aws-operations');

const { dataSource } = config.get('api');

/**
 * @summary Validate database configuration
 * @function
 */
const validateDataSource = async () => {
  try {
    if (dataSource === 'AWS') {
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
      console.error('Error: invalid option for api.dataSource. Valid options are "AWS" and "local"');
      process.exit(1);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = { validateDataSource };
