dynamo-butter
======

> If you are going to use the AWS "Thick" Client, you might as well add butter

**dynamo-butter** is inspired by the [AWS Dynamo Thin Client](https://github.com/Nike-Inc/aws-thin-dynamo-node). It uses `util.promsify` of the client methods, adds the same Quality-of-Life methods (e.g. `batchGetAll`), and sets up the `keep-alive` agent by default.

Since AWS Lambda provides `aws-sdk` by default, this library does not declare a dependency on it. However, it is required. If you need to run unit tests, make sure to add `aws-sdk` to your own `devDepdendencies`.

## Installation
```
npm i dynamo-butter
```

## Quick Start

```javascript
const Butter = require('dynamo-butter')
const client = Butter.up({ region: 'us-west-2' })
const data = await client.scanAll({ TableName: 'some-table' })
```

## API

**dynamo-butter** exports one method: `up()`. Which can be used in two different modes. The first parameter depends on the mode, while the second parameter provides config options to dynamo-butter.

### Configuration-Passthrough Mode
Uses the recommended defaults, with a configuration object that is passed to the DynamoDB **DocumentClient** constructor.

```javascript
const Butter = require('dynamo-butter')
const client = Butter.up({
  region: 'us-west-2',
  endpoint: IS_TESTING && TEST_SERVER_ENDPOINT,
  convertEmptyValues: true // optional, defaults to true
})
```

### Client-Wrap Mode
If you want to configure the DynamoDB DocumentClient yourself, you can pass it to butter instead of a config object.

```javascript
const Butter = require('dynamo-butter')
const Dynamo = require('aws-sdk/clients/dynamodb')
const dynamo = new Dynamo.DocumentClient({
  convertEmptyValues,
  service: new Dynamo({
    region,
    endpoint,
    httpOptions: { agent }
  })
})
const client = Butter.up(dynamo)
```

#### Config Options
The second parameter to `Butter.up()` is an options object for butter. It is optional, and each property is optional and defaults to true.

* **includeAutoPagingMethods**: set to `false` to not add `batchWriteAll` `batchGetAll` and `scanAll` to the client.
* **useKeepAlive**: set to false to disable `keepAlive` on the configured agent.

```javascript
const client = Butter.up({
  region: 'us-west-2',
  endpoint: IS_TESTING && TEST_SERVER_ENDPOINT,
  convertEmptyValues: true // optional, defaults to true
}, {
  includeAutoPagingMethods: true,
  useKeepAlive: true
}
```