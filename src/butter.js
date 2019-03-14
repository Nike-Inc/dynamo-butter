'use strict'

const { promisify } = require('util')
const methodsToWrap = [ 'query', 'scan', 'get', 'put', 'update', 'delete', 'batchGet', 'batchWrite' ]

module.exports = {
  up,
  churn: up // alias
}

function up (dynamoClientOrConfig, { includeAutoPagingMethods = true, useKeepAlive = true } = {}) {
  let client
  if (!dynamoClientOrConfig) throw new Error('"dynamoClientOrConfig" parameter is required')

  // dynamo methods mean this is a document client
  if (isFunction(dynamoClientOrConfig.query)) {
    client = dynamoClientOrConfig
  } else {
    if (!dynamoClientOrConfig.region) throw new Error('"region" is required when providing a configuration parameter')
    client = makeClient({ ...dynamoClientOrConfig, useKeepAlive })
  }

  methodsToWrap.forEach(method => {
    client[method] = promisify(client[method].bind(client))
  })

  if (includeAutoPagingMethods) {
    client.scanAll = scanAll.bind(null, client)
    client.batchWriteAll = batchWriteAll.bind(null, client)
    client.batchGetAll = batchGetAll.bind(null, client)
  }

  return client
}

function makeClient ({ region, endpoint, convertEmptyValues = true, useKeepAlive }) {
  const Dynamo = require('aws-sdk/clients/dynamodb')
  let agent
  let agentConfig = {
    keepAlive: useKeepAlive,
    maxSockets: useKeepAlive ? 50 : undefined
  }
  if (endpoint && endpoint.includes('http:')) {
    const http = require('http')
    agent = new http.Agent(agentConfig)
  } else {
    const https = require('https')
    agent = new https.Agent({ ...agentConfig, rejectUnauthorized: true })
    agent.setMaxListeners(0)
  }
  const dynamo = new Dynamo({
    region,
    endpoint,
    httpOptions: { agent }
  })
  return new Dynamo.DocumentClient({
    convertEmptyValues,
    service: dynamo
  })
}

async function scanAll (dynamoClient, params) {
  params = { ...params }
  let result
  let scanLimit = params.ScanLimit
  let itemLimit = params.ItemLimit
  delete params.ScanLimit
  delete params.ItemLimit

  let response = {}
  let workRemaining
  do {
    response = await dynamoClient.scan({ ...params, ExclusiveStartKey: response.LastEvaluatedKey })
    // First run
    if (result === undefined) {
      result = response
    } else {
      result.Count += response.Count
      result.ScannedCount += response.ScannedCount
      result.Items = result.Items.concat(response.Items)
    }
    workRemaining = response.LastEvaluatedKey &&
      (scanLimit === undefined || result.ScannedCount < scanLimit) &&
      (itemLimit === undefined || result.Count < itemLimit)
  } while (workRemaining)

  delete result.LastEvaluatedKey
  return result
}

async function batchWriteAll (dynamoClient, params) {
  let requestPool = Object.assign({}, params.RequestItems)
  let pageSize = params.PageSize
  delete params.PageSize

  while (true) {
    let batch = sliceWriteBatch(requestPool, pageSize)
    if (batch === undefined || Object.keys(batch).length === 0) return
    let response = await dynamoClient.batchWrite({ ...params, RequestItems: batch })
    let unprocessed = response.UnprocessedItems && Object.keys(response.UnprocessedItems).length !== 0 ? response.UnprocessedItems : null
    if (!unprocessed) continue
    eachObj(unprocessed, (table, items) => {
      requestPool[table] = requestPool[table].concat(items)
    })
  }
}

function sliceWriteBatch (pool, pageSize) {
  pageSize = pageSize || 25
  let requestCount = 0
  let batch = {}
  let tables = Object.keys(pool)
  if (tables.length === 0) return
  tables.forEach((tableName, i) => {
    let table = pool[tableName]
    if (requestCount === pageSize || !table.length) return
    let items = table.splice(0, pageSize - requestCount)
    if (items.length === 0) return
    requestCount += items.length
    batch[tableName] = batch[tableName] !== undefined ? batch[tableName].concat(items) : items
  })
  return batch
}

async function batchGetAll (dynamoClient, params) {
  let requestPool = Object.assign({}, params.RequestItems)
  let pageSize = params.PageSize
  delete params.PageSize
  let responses = {}

  while (true) {
    let batch = sliceGetBatch(requestPool, pageSize)
    if (batch === undefined || Object.keys(batch).length === 0) break
    let response = await dynamoClient.batchGet({ ...params, RequestItems: batch })
    eachObj(response.Responses, (table, items) => {
      if (!responses[table]) responses[table] = []
      responses[table] = responses[table].concat(items)
    })
    let unprocessed = response.UnprocessedKeys && Object.keys(response.UnprocessedKeys).length !== 0 ? response.UnprocessedKeys : null
    if (!unprocessed) continue
    eachObj(unprocessed, (table, items) => {
      requestPool[table].Keys = requestPool[table].Keys.concat(items.Keys)
    })
  }

  return { Responses: responses }
}

function sliceGetBatch (pool, pageSize) {
  pageSize = pageSize || 25
  let requestCount = 0
  let batch = {}
  let tables = Object.keys(pool)
  if (tables.length === 0) return
  tables.forEach((tableName, i) => {
    let table = pool[tableName]
    if (requestCount === pageSize || !table.Keys.length) return
    let keys = table.Keys.splice(0, pageSize - requestCount)
    if (keys.length === 0) return
    requestCount += keys.length
    if (!batch[tableName]) batch[tableName] = Object.assign({}, table, { Keys: [] })
    batch[tableName].Keys = batch[tableName].Keys.concat(keys)
  })
  return batch
}

function eachObj (obj, func) {
  Object.keys(obj).forEach(key => {
    func(key, obj[key])
  })
}

function isFunction (func) {
  return typeof func === 'function'
}
