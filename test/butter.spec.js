/* eslint-disable no-console */
'use strict'

process.env.AWS_ACCESS_KEY_ID = 'FAKE_KEY_ID'
process.env.AWS_SECRET_ACCESS_KEY = 'FAKE_KEY'

const test = require('blue-tape')
const nock = require('nock')
const DynamoDB = require('aws-sdk/clients/dynamodb')
const awsConverter = DynamoDB.Converter
const Butter = require('../src/butter')

let validConfig = {
  region: 'us-west-2',
  endpoint: 'http://localhost:4567/'
}
const table = 'test-table'

test('butter.up provides a wrapped client when config is valid', async t => {
  t.plan(5)
  let client = Butter.up(validConfig)
  t.equal(client.service.config.region, validConfig.region, 'region')
  t.equal(client.service.endpoint.href, validConfig.endpoint, 'endpoint')
  t.equal(typeof client.query, 'function', 'query')
  t.equal(typeof client.batchWriteAll, 'function', 'batchWriteAll')
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, {})
  let result = client.query({ TableName: 'test' })
  t.equal(typeof result.then, 'function', 'promise')
  await result
})

test('butter.up provides a wrapped client when given dynamo client', async t => {
  t.plan(5)
  const Dynamo = require('aws-sdk/clients/dynamodb')
  let dynamo = new Dynamo.DocumentClient(validConfig)
  let client = Butter.up(dynamo)
  t.equal(client.service.config.region, validConfig.region, 'region')
  t.equal(client.service.endpoint.href, validConfig.endpoint, 'endpoint')
  t.equal(typeof client.query, 'function', 'query')
  t.equal(typeof client.batchWriteAll, 'function', 'batchWriteAll')
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, {})
  let result = client.query({ TableName: 'test' })
  t.equal(typeof result.then, 'function', 'promise')
  await result
})

test('butter.up defaults to dynamo https', async t => {
  t.plan(2)
  let client = Butter.up({ region: 'us-west-2' })
  t.equal(client.service.config.region, 'us-west-2', 'region')
  t.equal(
    client.service.endpoint.href,
    'https://dynamodb.us-west-2.amazonaws.com/',
    'endpoint'
  )
})

test('butter.up requires config', async t => {
  t.plan(1)
  t.throws(() => Butter.up(), /dynamoClientOrConfig.+?required/)
})

test('butter.up requires region', async t => {
  t.plan(1)
  t.throws(() => Butter.up({}), /region/)
})

// QoL Methods
//
test('batchWriteAll sends 30 items in two pages', async t => {
  t.plan(2)
  let client = Butter.up(validConfig)
  let data = [...Array(30)].map((_, i) => ({ clientId: `test_delete_me_${i}` }))
  let deleteParams = {
    RequestItems: { [table]: data.map(c => ({ PutRequest: { Item: c } })) }
  }
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].length, 25, 'page size')
      return [200, {}]
    })
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].length, 5, 'page size')
      return [200, {}]
    })
  return client.batchWriteAll(deleteParams).catch(e => {
    console.error(e)
    throw e
  })
})

test('batchWriteAll allows custom page size', async t => {
  t.plan(2)
  let client = Butter.up(validConfig)
  let data = [...Array(20)].map((_, i) => ({ clientId: `test_delete_me_${i}` }))
  let deleteParams = {
    PageSize: 10,
    RequestItems: { [table]: data.map(c => ({ PutRequest: { Item: c } })) }
  }
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .times(2)
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].length, 10, 'page size')
      return [200, {}]
    })
  return client.batchWriteAll(deleteParams)
})

test('batchWriteAll handles multiple tables', async t => {
  t.plan(3)
  let client = Butter.up(validConfig)
  let data = [...Array(20)].map((_, i) => ({ clientId: `test_delete_me_${i}` }))
  let deleteParams = {
    RequestItems: {
      [table]: data.map(c => ({ PutRequest: { Item: c } })),
      [table + '2']: data.map(c => ({ PutRequest: { Item: c } }))
    }
  }
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].length, 20, 'page size')
      t.equal(body.RequestItems[table + 2].length, 5, 'page size')
      return [200, {}]
    })
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table + 2].length, 15, 'page size')
      return [200, {}]
    })
  return client.batchWriteAll(deleteParams).catch(e => {
    console.error(e)
    throw e
  })
})

test('batchWriteAll retries unprocessed items', async t => {
  t.plan(2)
  let client = Butter.up(validConfig)
  let data = [...Array(25)].map((_, i) => ({ clientId: `test_delete_me_${i}` }))
  let deleteParams = {
    RequestItems: { [table]: data.map(c => ({ PutRequest: { Item: c } })) }
  }
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].length, 25, 'page size')
      return {
        UnprocessedItems: {
          [table]: data
            .slice(20)
            .map(c => ({ PutRequest: { Item: awsConverter.marshall(c) } }))
        }
      }
    })
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].length, 5, 'retried')
      return {}
    })
  return client.batchWriteAll(deleteParams)
})

test('batchGetAll sends 30 items in two pages', async t => {
  t.plan(3)
  let client = Butter.up(validConfig)
  let data = [...Array(30)].map((_, i) => ({ clientId: `test_delete_me_${i}` }))
  let deleteParams = { RequestItems: { [table]: { Keys: data.slice(0) } } }
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].Keys.length, 25, 'page size')
      return {
        Responses: { [table]: data.slice(0, 25).map(awsConverter.marshall) }
      }
    })
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].Keys.length, 5, 'page size')
      return {
        Responses: { [table]: data.slice(25).map(awsConverter.marshall) }
      }
    })

  return client
    .batchGetAll(deleteParams)
    .then(result => {
      t.deepEqual(data, result.Responses[table], 'returned all rows')
    })
    .catch(e => {
      console.error(e)
      throw e
    })
})

test('batchGetAll allows custom page size', async t => {
  t.plan(3)
  let client = Butter.up(validConfig)
  let data = [...Array(20)].map((_, i) => ({ clientId: `test_delete_me_${i}` }))
  let deleteParams = {
    PageSize: 10,
    RequestItems: { [table]: { Keys: data.slice(0) } }
  }
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].Keys.length, 10, 'page size')
      return {
        Responses: { [table]: data.slice(0, 10).map(awsConverter.marshall) }
      }
    })
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].Keys.length, 10, 'page size')
      return {
        Responses: { [table]: data.slice(10).map(awsConverter.marshall) }
      }
    })

  return client.batchGetAll(deleteParams).then(result => {
    t.deepEqual(data, result.Responses[table], 'returned all rows')
  })
})

test('batchGetAll handles multiple tables', async t => {
  t.plan(5)
  let client = Butter.up(validConfig)
  let data = [...Array(20)].map((_, i) => ({ clientId: `test_delete_me_${i}` }))
  let deleteParams = {
    RequestItems: {
      [table]: { Keys: data.slice(0) },
      [table + '2']: { Keys: data.slice(0) }
    }
  }
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].Keys.length, 20, 'page size')
      t.equal(body.RequestItems[table + 2].Keys.length, 5, 'page size')
      return {
        Responses: {
          [table]: data.slice(0).map(awsConverter.marshall),
          [table + '2']: data.slice(0, 5).map(awsConverter.marshall)
        }
      }
    })
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table + 2].Keys.length, 15, 'page size')
      return {
        Responses: { [table + '2']: data.slice(5).map(awsConverter.marshall) }
      }
    })
  return client.batchGetAll(deleteParams).then(result => {
    t.deepEqual(data, result.Responses[table], 'returned table rows')
    t.deepEqual(data, result.Responses[table + '2'], 'returned table2 rows')
  })
})

test('batchGetAll retries unprocessed items', async t => {
  t.plan(3)
  let client = Butter.up(validConfig)
  let data = [...Array(25)].map((_, i) => ({ clientId: `test_delete_me_${i}` }))
  let deleteParams = { RequestItems: { [table]: { Keys: data.slice(0) } } }
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].Keys.length, 25, 'page size')
      return {
        Responses: { [table]: data.slice(0, 20).map(awsConverter.marshall) },
        UnprocessedKeys: {
          [table]: { Keys: data.slice(20).map(awsConverter.marshall) }
        }
      }
    })
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function(uri, requestBody) {
      let body = JSON.parse(requestBody)
      t.equal(body.RequestItems[table].Keys.length, 5, 'retried')
      return {
        Responses: { [table]: data.slice(20).map(awsConverter.marshall) }
      }
    })
  return client.batchGetAll(deleteParams).then(result => {
    t.deepEqual(data, result.Responses[table], 'returned all rows')
  })
})

test('queryAll gets multiple pages', async t => {
  t.plan(4)
  let client = Butter.up(validConfig)
  let data = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function() {
      t.pass('called')
      return {
        Count: 2,
        ScannedCount: 100,
        LastEvaluatedKey: { id: 2 },
        Items: data.slice(0, 2).map(awsConverter.marshall)
      }
    })
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function() {
      t.pass('called')
      return {
        Count: 2,
        ScannedCount: 100,
        Items: data.slice(2).map(awsConverter.marshall)
      }
    })
  let result = await client.queryAll({ TableName: table })
  t.equal(result.Items.length, 4, 'count')
  t.same(result.Items, data, 'matches')
})

test('scanAll gets multiple pages', async t => {
  t.plan(4)
  let client = Butter.up(validConfig)
  let data = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function() {
      t.pass('called')
      return {
        Count: 2,
        ScannedCount: 100,
        LastEvaluatedKey: { id: 2 },
        Items: data.slice(0, 2).map(awsConverter.marshall)
      }
    })
  nock(/localhost/)
    .replyContentLength()
    .post('/')
    .reply(200, function() {
      t.pass('called')
      return {
        Count: 2,
        ScannedCount: 100,
        Items: data.slice(2).map(awsConverter.marshall)
      }
    })
  let result = await client.scanAll({ TableName: table })
  t.equal(result.Items.length, 4, 'count')
  t.same(result.Items, data, 'matches')
})
