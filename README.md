# Express API Skeleton

Skeleton for Express APIs.

## Getting Started

### Prerequisites

1. Install Node.js from [nodejs.org](https://nodejs.org/en/).
2. Generate a self signed certificate with [OpenSSL](https://www.openssl.org/):

    ```shell
    $ openssl req -newkey rsa:2048 -new -nodes -keyout key.pem -out csr.pem
    $ openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out server.crt
    ```

3. Copy [config/example.yaml](config/example.yaml) to `config/default.yaml`. Modify as necessary, being careful to avoid committing sensitive data.

    * **Environment variables**: Sensitive data and data that changes per environment has been moved into environment variables. Below is a list of the variables along with a definition:

        | Environment variable | Description |
        | -------------------- | ----------- |
        | **${PORT}** | The port used by the API. |
        | **${ADMIN_PORT}** | The port used by the **ADMIN** endpoint. |
        | **${USER}** | The HTTP Basic username used to authenticate API calls. |
        | **${PASSWD}** | The HTTP Basic password used to authenticate API calls. |
        | **${ENDPOINTURI}** | API endpoint URI. |

    * **Options for logger configuration**:

        | Option | Description |
        | ------ | ----------- |
        | **size** | Maximum size of the file after which it will rotate. This can be a number of bytes, or units of kb, mb, and gb. If using the units, add 'k', 'm', or 'g' as the suffix. The units need to directly follow the number. |
        | **path** | The directory name to save log files to. |
        | **pattern** | A string representing the [moment.js date format](https://momentjs.com/docs/#/displaying/format/) to be used for rotating. The meta characters used in this string will dictate the frequency of the file rotation. For example, if your datePattern is simply 'HH' you will end up with 24 log files that are picked up and appended to every day. |
        | **archive** | A boolean to define whether or not to gzip archived log files. |

### Installing

```shell
# Using yarn (recommended)
$ yarn

# Using npm
$ npm install
```

### Usage

Run the application:

  ```shell
  # Run linting and testing tasks before start the app
  $ gulp run

  # Run the app without running linting and testing tasks (only for development)
  $ nodemon app.js
  ```

## Running the tests

### Linting

Run [ESLint](https://eslint.org/) to check the code:

```shell
# Using npm
$ npm run lint

# Using gulp
$ gulp lint
```

_Note: We are following [Airbnb's style](https://github.com/airbnb/javascript) as the JavaScript style guide_

### Testing

Run unit tests:

```shell
# Using npm
$ npm test
```

## Base project off the skeleton

### Base a new project off the skeleton

1. Clone the skeleton:

    ```shell
    $ git clone --origin skeleton git@github.com:osu-mist/express-api-skeleton.git <my-api>
    ```

2. Rename project by modifying [package.json](./package.json).

3. We use [express-openapi](https://www.npmjs.com/package/express-openapi) to generate API by inheriting openapi.yaml. Create path handlers and put them into corresponding directories. For example:

    * The path handler for `/api/v1/pets` should go to [api/v1/paths/pet.js](api/v1/paths/pet.js)
    * The path handler for `/api/v1/pets/{id}` should go to [api/v1/paths/pet/{id}.js](api/v1/paths/pet/{id}.js)

4. Copy [api/v1/serializers/pets-serializers.js](api/v1/serializers/pets-serializers.js) to `api/v1/serializers/<resources>-serializers.js` and modify as necessary:

    ```shell
    $ cp api/v1/serializers/pets-serializers.js api/v1/serializers/<resources>-serializers.js
    ```

### Base an existing project off / Incorporate updates from the skeleton

1. Add the skeleton as a remote:

    ```shell
    $ git remote add skeleton git@github.com:osu-mist/express-api-skeleton.git
    ```

2. Fetch updates from the skeleton:

    ```shell
    $ git fetch skeleton
    ```

3. Merge the skeleton into your codebase:

    ```shell
    $ git checkout feature/CO-1234-branch
    $ git merge skeleton/master
    $ git commit -v
    ```

## Getting data source from HTTP endpoints

The following instructions show you how to get data from external endpoints for use in the API.

1. Configure data source section in the `/config/default.yaml`. For example:

    ```yaml
    httpDataSource:
        url: 'https://api.example.com'
    ```

2. Copy [api/v1/db/http/notes-dao.js](api/v1/db/http/pets-dao-example.js) to `api/v1/db/http/<resources>-dao.js` and modify as necessary:

    ```shell
    $ cp api/v1/db/http/notes-dao.js api/v1/db/http/<resources>-dao.js
    ```

3. Make sure to require the correct path for the new DAO file at path handlers files:

    ```js
    const petsDAO = require('../db/http/<resources>-dao');
    ```

## Getting data source from the Oracle Database

The following instructions show you how to connect the API to an Oracle database.

1. Install [Oracle Instant Client](http://www.oracle.com/technetwork/database/database-technologies/instant-client/overview/index.html) by following [this installation guide](https://oracle.github.io/odpi/doc/installation.html).


2. Install [oracledb](https://www.npmjs.com/package/oracledb) via package management:

    ```shell
    # Using yarn (recommended)
    $ yarn add oracledb

    # Using npm
    $ npm install oracledb
    ```

3. Define `database` section in the `/config/default.yaml` to be like:

    ```yaml
    database:
      connectString: ${DB_URL}
      user: ${DB_USER}
      password: ${DB_PASSWD}
      poolMin: 30
      poolMax: 30
      poolIncrement: 0
    ```

    **Options for database configuration**:

    | Option | Description |
    | ------ | ----------- |
    | **poolMin** | The minimum number of connections a connection pool maintains, even when there is no activity to the target database. |
    | **poolMax** | The maximum number of connections that can be open in the connection pool. |
    | **poolIncrement** | The number of connections that are opened whenever a connection request exceeds the number of currently open connections. |

    > Note: To avoid `ORA-02396: exceeded maximum idle time` and prevent deadlocks, the [best practice](https://github.com/oracle/node-oracledb/issues/928#issuecomment-398238519) is to keep `poolMin` the same as `poolMax`. Also, ensure [increasing the number of worker threads](https://github.com/oracle/node-oracledb/blob/node-oracledb-v1/doc/api.md#-82-connections-and-number-of-threads) available to node-oracledb. The thread pool size should be at least equal to the maximum number of connections and less than 128.

4. If the SQL codes/queries contain intellectual property like Banner table names, put them into `api/v1/db/oracledb/contrib` folder and use [git-submodule](https://git-scm.com/docs/git-submodule) to manage submodules:

    * Add the given repository as a submodule at `api/v1/db/oracledb/contrib`:

        ```shell
        $ git submodule add <contrib_repo_git_url> api/v1/db/oracledb/contrib
        ```

    * Fetch the submodule from the contrib repository:

        ```shell
        $ git submodule update --init
        ```

5. Rename [api/v1/db/oracledb/connection-example.js](api/v1/db/oracledb/connection-example.js) to `api/v1/db/oracledb/connection.js`:

    ```shell
    $ git mv api/v1/db/oracledb/connection-example.js api/v1/db/oracledb/connection.js
    ```

6. Copy [api/v1/db/oracledb/notes-dao.js](api/v1/db/oracledb/pets-dao-example.js) to `api/v1/db/oracledb/<resources>-dao.js` and modify as necessary:

    ```shell
    $ cp api/v1/db/oracledb/notes-dao.js api/v1/db/oracledb/<resources>-dao.js
    ```

7. Make sure to require the correct path for the new DAO file at path handlers files:

    ```js
    const petsDAO = require('../db/oracledb/<resources>-dao');
    ```

## Docker

[Dockerfile](Dockerfile) is also provided. To run the app in a container, install [Docker](https://www.docker.com/) first, then:

1. Build the docker image:

  ```shell
  $ docker build -t express-api-skeleton .
  ```

2. Run the app in a container:

  ```shell
  $ docker run -d \
               -p 8080:8080 \
               -p 8081:8081 \
               -v path/to/keytools/:/usr/src/express-api-skeleton/keytools:ro \
               -v "$PWD"/config:/usr/src/express-api-skeleton/config:ro \
               -v "$PWD"/logs:/usr/src/express-api-skeleton/logs \
               --name express-api-skeleton \
               express-api-skeleton
  ```
