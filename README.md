dynamo-butter
======

> For a smoother, richer experience use Butter

## Why

The new AWS SDK v3 uses a modular design with typescript-generated code, providing faster startup, tree-shaking, and great intellisense. However it doesn't automatically marshall DyanmoDB's types into JS objects the way the v2 `DocumentClient` did and there is [strong internal resistance](https://github.com/aws/aws-sdk-js-v3/issues/1223) to providing this functionality.

Butter marshalls DynamoDB types for all operations. It also provides [automatic paging methods](#automatic-paging) for `query|scan|batchGet|batchWrite`. It's written in Typescript so you keep the intellisense and its built with rollup to retain tree-shakability.

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
const { Agent } = require("https");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");

// Disable keep-alive if you want bad performance
const dynamo = new DynamoDBClient({
  requestHandler: new NodeHttpHandler({
    httpsAgent: new Agent({ keepAlive: false }),
  }),
})
const client = Butter.up(dynamo)
```

#### Config Options
The second parameter to `Butter.up()` is an options object for butter. It is optional; each property is also optional and defaults to true.

```javascript
const client = Butter.up({
  region: 'us-west-2',
}, {
  convertEmptyValues: true,
  removeUndefinedValues: true,
}
```

## Automatic Paging 

Butter provides 4 methods for automatically paging through the methods that can return unfinished results: `query`, `scan`, `batchGet` and `batchWrite`. Be warned that you can easily run out of memory, or cause very large cost-usage, when using these methods. Make sure you understand the scan-space before using them.