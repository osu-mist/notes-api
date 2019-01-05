const appRoot = require('app-root-path');
const bodyParser = require('body-parser');
const { compose, errors } = require('compose-middleware');
const config = require('config');
const express = require('express');
const { initialize } = require('express-openapi');
const fs = require('fs');
const https = require('https');
const moment = require('moment');
const git = require('simple-git/promise');

const { errorBuilder, errorHandler } = appRoot.require('errors/errors');
const { authentication } = appRoot.require('middlewares/authentication');
const { genericErrorMiddleware } = appRoot.require('middlewares/generic-error-middleware');
const { logger } = appRoot.require('middlewares/logger');
const { openAPIErrorMiddleware } = appRoot.require('middlewares/openapi-error-middleware');
const { openapi } = appRoot.require('utils/load-openapi');

const serverConfig = config.get('server');

/**
 * @summary Initialize Express applications and routers
 */
const app = express();
const appRouter = express.Router();
const adminApp = express();
const adminAppRouter = express.Router();

/**
 * @summary Use the simple query parser to prevent the parameters which contain square brackets
 * be parsed as a nested object
 */
app.set('query parser', 'simple');

/**
 * @summary Create and start HTTPS servers
 */
const httpsOptions = {
  key: fs.readFileSync(serverConfig.keyPath),
  cert: fs.readFileSync(serverConfig.certPath),
  secureProtocol: serverConfig.secureProtocol,
};
const httpsServer = https.createServer(httpsOptions, app);
const adminHttpsServer = https.createServer(httpsOptions, adminApp);

/**
 * @summary Middlewares for routers, logger and authentication
 */
const baseEndpoint = `${serverConfig.basePathPrefix}`;
app.use(baseEndpoint, appRouter);
adminApp.use(baseEndpoint, adminAppRouter);

appRouter.use(logger);
appRouter.use(authentication);
adminAppRouter.use(authentication);

/**
 * @summary Return API meta information at admin endpoint
 */
adminAppRouter.get(`${openapi.basePath}`, async (req, res) => {
  try {
    const commit = await git().revparse(['--short', 'HEAD']);
    const now = moment();
    const info = {
      meta: {
        name: openapi.info.title,
        time: now.format('YYYY-MM-DD HH:mm:ssZZ'),
        unixTime: now.unix(),
        commit: commit.trim(),
        documentation: 'openapi.yaml',
      },
    };
    res.send(info);
  } catch (err) {
    errorHandler(res, err);
  }
});

/**
 * @summary Middleware that improves the error message when failing to parse JSON
 */
const bodyParserErrorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError) {
    err.customStatus = 400;
    err.customMessage = `Error parsing JSON: ${err}`;
  }
  next(err);
};

/**
 * @summary Initialize API with OpenAPI specification
 */
initialize({
  app: appRouter,
  apiDoc: openapi,
  paths: `${appRoot}/api/v1/paths`,
  consumesMiddleware: {
    'application/json': compose([bodyParser.json(), bodyParserErrorHandler]),
  },
  errorMiddleware: errors([openAPIErrorMiddleware, genericErrorMiddleware]),
  errorTransformer: (openapiError, ajvError) => Object.assign({}, openapiError, ajvError),
});

/**
 * @summary Return a 404 error if resource not found
 */
appRouter.use((req, res) => errorBuilder(res, 404, 'Resource not found.'));

/**
 * @summary Start servers and listen on ports
 */
httpsServer.listen(serverConfig.port);
adminHttpsServer.listen(serverConfig.adminPort);
