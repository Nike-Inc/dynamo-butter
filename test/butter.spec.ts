import { describe, expect, it } from '@jest/globals'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import { up } from '../src/butter'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nock = require('nock')

process.env.AWS_ACCESS_KEY_ID = 'FAKE_KEY_ID'
process.env.AWS_SECRET_ACCESS_KEY = 'FAKE_KEY'

const useConfig = (config = {}) => ({
  region: 'us-west-2',
  endpoint: 'http://localhost:4567/',
  ...config,
})

const tableName = 'test-table'

describe('up', () => {
  it('returns client when config is passed in', async () => {
    const client = up(useConfig())
    // console.log(client)
    expect(client).toBeDefined()

    expect(typeof client.query).toBe('function')
    expect(typeof client.batchWriteAll).toBe('function')
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, {})
    const result = client.query({ TableName: 'test' })
    expect(typeof result.then).toBe('function')
    await result
  })

  it('up provides a wrapped client when config contains creds', async () => {
    const credentials = {
      accessKeyId: 'a1',
      secretAccessKey: 'k1',
      sessionToken: 'tok',
    }
    const client = up(useConfig({ credentials }))
    const configCreds = await client._dynamo.config.credentials()
    expect(configCreds).toBe(credentials)
  })
  it('up provides a wrapped client when given dynamo client', async () => {
    const dynamo = new DynamoDBClient(useConfig())
    const client = up(dynamo)

    expect(client).toBeDefined()

    expect(typeof client.query).toBe('function')
    expect(typeof client.batchWriteAll).toBe('function')
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, {})
    const result = client.query({ TableName: 'test' })
    expect(typeof result.then).toBe('function')
    await result
  })

  it('up requires config', async () => {
    expect(() => up()).toThrowError(/dynamoClientOrConfig.+?required/)
  })

  it('up requires config', async () => {
    expect(() => up({ region: undefined })).toThrowError(/region.+?required/)
  })
})

describe('client', () => {
  beforeEach(() => {
    nock.cleanAll()
  })
  it('batchWriteAll sends 30 items in two pages', async () => {
    const client = up(useConfig())
    const data = [...Array(30)].map((_, i) => ({
      clientId: `test_delete_me_${i}`,
    }))
    const deleteParams = {
      RequestItems: {
        [tableName]: data.map((c) => ({ PutRequest: { Item: c } })),
      },
    }
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].length).toBe(25)
        return [200, {}]
      })
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].length).toBe(5)
        return [200, {}]
      })
    return client.batchWriteAll(deleteParams).catch((e) => {
      console.error(e)
      throw e
    })
  })

  test('batchWriteAll allows custom page size', async () => {
    const client = up(useConfig())
    const data = [...Array(20)].map((_, i) => ({
      clientId: `test_delete_me_${i}`,
    }))
    const deleteParams = {
      PageSize: 10,
      RequestItems: {
        [tableName]: data.map((c) => ({ PutRequest: { Item: c } })),
      },
    }
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .times(2)
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].length).toBe(10)
        return [200, {}]
      })
    return client.batchWriteAll(deleteParams)
  })

  test('batchWriteAll handles multiple tables', async () => {
    const client = up(useConfig())
    const data = [...Array(20)].map((_, i) => ({
      clientId: `test_delete_me_${i}`,
    }))
    const deleteParams = {
      RequestItems: {
        [tableName]: data.map((c) => ({ PutRequest: { Item: c } })),
        [tableName + '2']: data.map((c) => ({ PutRequest: { Item: c } })),
      },
    }
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].length).toBe(20)
        expect(body.RequestItems[tableName + 2].length).toBe(5)
        return [200, {}]
      })
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName + 2].length).toBe(15)
        return [200, {}]
      })
    return client.batchWriteAll(deleteParams).catch((e) => {
      console.error(e)
      throw e
    })
  })

  test('batchWriteAll retries unprocessed items', async () => {
    const client = up(useConfig())
    const data = [...Array(25)].map((_, i) => ({
      clientId: `test_delete_me_${i}`,
    }))
    const deleteParams = {
      RequestItems: {
        [tableName]: data.map((c) => ({ PutRequest: { Item: c } })),
      },
    }
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].length).toBe(25)
        return {
          UnprocessedItems: {
            [tableName]: data
              .slice(20)
              .map((c) => ({ PutRequest: { Item: marshall(c) } })),
          },
        }
      })
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].length).toBe(5)
        return {}
      })
    return client.batchWriteAll(deleteParams)
  })

  test('batchGetAll sends 30 items in two pages', async () => {
    const client = up(useConfig())
    const data = [...Array(30)].map((_, i) => ({
      clientId: `test_delete_me_${i}`,
    }))
    const deleteParams = {
      RequestItems: { [tableName]: { Keys: data.slice(0) } },
    }
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].Keys.length).toBe(25)
        return {
          Responses: { [tableName]: data.slice(0, 25).map(marshall) },
        }
      })
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].Keys.length).toBe(5)
        return {
          Responses: { [tableName]: data.slice(25).map(marshall) },
        }
      })

    return client
      .batchGetAll(deleteParams)
      .then((result) => {
        expect(data).toEqual(result.Responses[tableName])
      })
      .catch((e) => {
        console.error(e)
        throw e
      })
  })

  test('batchGetAll allows custom page size', async () => {
    const client = up(useConfig())
    const data = [...Array(20)].map((_, i) => ({
      clientId: `test_delete_me_${i}`,
    }))
    const deleteParams = {
      PageSize: 10,
      RequestItems: { [tableName]: { Keys: data.slice(0) } },
    }
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].Keys.length).toBe(10)
        return {
          Responses: { [tableName]: data.slice(0, 10).map(marshall) },
        }
      })
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].Keys.length).toBe(10)
        return {
          Responses: { [tableName]: data.slice(10).map(marshall) },
        }
      })

    return client.batchGetAll(deleteParams).then((result) => {
      expect(data).toEqual(result.Responses[tableName])
    })
  })

  test('batchGetAll handles multiple tables', async () => {
    const client = up(useConfig())
    const data = [...Array(20)].map((_, i) => ({
      clientId: `test_delete_me_${i}`,
    }))
    const deleteParams = {
      RequestItems: {
        [tableName]: { Keys: data.slice(0) },
        [tableName + '2']: { Keys: data.slice(0) },
      },
    }
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].Keys.length).toBe(20)
        expect(body.RequestItems[tableName + 2].Keys.length).toBe(5)
        return {
          Responses: {
            [tableName]: data.slice(0).map(marshall),
            [tableName + '2']: data.slice(0, 5).map(marshall),
          },
        }
      })
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName + 2].Keys.length).toBe(15)
        return {
          Responses: { [tableName + '2']: data.slice(5).map(marshall) },
        }
      })
    return client.batchGetAll(deleteParams).then((result) => {
      expect(data).toEqual(result.Responses[tableName])
      expect(data).toEqual(result.Responses[tableName + '2'])
    })
  })

  test('batchGetAll retries unprocessed items', async () => {
    const client = up(useConfig())
    const data = [...Array(25)].map((_, i) => ({
      clientId: `test_delete_me_${i}`,
    }))
    const deleteParams = {
      RequestItems: { [tableName]: { Keys: data.slice(0) } },
    }
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].Keys.length).toBe(25)
        return {
          Responses: { [tableName]: data.slice(0, 20).map(marshall) },
          UnprocessedKeys: {
            [tableName]: { Keys: data.slice(20).map(marshall) },
          },
        }
      })
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function (uri, requestBody) {
        const body = JSON.parse(requestBody)
        expect(body.RequestItems[tableName].Keys.length).toBe(5)
        return {
          Responses: { [tableName]: data.slice(20).map(marshall) },
        }
      })
    return client.batchGetAll(deleteParams).then((result) => {
      expect(data).toEqual(result.Responses[tableName])
    })
  })

  test('queryAll gets multiple pages', async () => {
    const client = up(useConfig())
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
    const stub = jest.fn()
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function () {
        stub()
        return {
          Count: 2,
          ScannedCount: 100,
          LastEvaluatedKey: marshall({ id: 2 }),
          Items: data.slice(0, 2).map(marshall),
        }
      })
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function () {
        stub()
        return {
          Count: 2,
          ScannedCount: 100,
          Items: data.slice(2).map(marshall),
        }
      })
    const result = await client.queryAll({ TableName: tableName })
    expect(result.Items.length).toBe(4)
    expect(result.Items).toEqual(data)
    expect(stub).toHaveBeenCalledTimes(2)
  })

  test('scanAll gets multiple pages', async () => {
    const client = up(useConfig())
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
    const stub = jest.fn()
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function () {
        stub()

        return {
          Count: 2,
          ScannedCount: 100,
          LastEvaluatedKey: marshall({ id: 2 }),
          Items: data.slice(0, 2).map(marshall),
        }
      })
    nock(/localhost/)
      .replyContentLength()
      .post('/')
      .reply(200, function () {
        stub()

        return {
          Count: 2,
          ScannedCount: 100,
          Items: data.slice(2).map(marshall),
        }
      })
    const result = await client.scanAll({ TableName: tableName })
    expect(result.Items.length).toBe(4)
    expect(result.Items).toEqual(data)
    expect(stub).toHaveBeenCalledTimes(2)
  })
})
