import {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  BatchGetItemCommand,
  BatchWriteItemCommand,
  WriteRequest,
  KeysAndAttributes,
  AttributeValueUpdate,
} from '@aws-sdk/client-dynamodb'
import type {
  DynamoDBClientConfig,
  ScanOutput,
  UpdateItemInput,
  BatchGetItemInput,
  PutRequest,
  DeleteRequest,
} from '@aws-sdk/client-dynamodb'

import { unmarshall, marshalKeys } from './marshalling'
import type {
  Marshallable,
  MarshalledItem,
  NativeItem,
  QueryInputNative,
  QueryOutputNative,
  ScanInputNative,
  ScanOutputNative,
  GetItemInputNative,
  GetItemOutputNative,
  PutItemInputNative,
  PutItemOutputNative,
  UpdateItemInputNative,
  UpdateItemOutputNative,
  DeleteItemInputNative,
  DeleteItemOutputNative,
  BatchGetItemInputNative,
  BatchGetItemOutputNative,
  BatchWriteItemInputNative,
  BatchWriteItemOutputNative,
  AttributeValueUpdateNative,
  KeysAndAttributesNative,
  PutRequestNative,
  DeleteRequestNative,
  WriteRequestNative,
} from './marshalling'

export type { DynamoDBClient, DynamoDBClientConfig }

export type DynamoButterClient = ButterClient

export interface ButterClientOptions {
  convertEmptyValues?: boolean
  removeUndefinedValues?: boolean
  useKeepAlive?: boolean
}

export interface QueryAllInput extends QueryInputNative {
  QueryLimit?: number
  ItemLimit?: number
}

export interface ScanAllInput extends ScanInputNative {
  ScanLimit?: number
  ItemLimit?: number
}

export interface BatchGetItemAllInput extends BatchGetItemInputNative {
  PageSize?: number
}

export interface BatchWriteItemAllInput extends BatchWriteItemInputNative {
  PageSize?: number
}

class ButterClient {
  _dynamo: DynamoDBClient
  _options: ButterClientOptions
  constructor(dynamo: DynamoDBClient, options: ButterClientOptions) {
    if (!dynamo) throw new Error('"dynamo" is required')
    this._dynamo = dynamo
    this._options = options
  }

  marshall<T extends Marshallable, K extends T, S extends keyof T>(item: K, keys: S[]): T {
    return marshalKeys<T, K, S>(item, keys, {
      convertEmptyValues: this._options.convertEmptyValues ?? true,
      removeUndefinedValues: this._options.removeUndefinedValues ?? true,
    })
  }

  unmarshall(item: MarshalledItem): NativeItem {
    return unmarshall(item)
  }

  async query(params: QueryInputNative): Promise<QueryOutputNative> {
    const response = await this._dynamo.send(
      new QueryCommand(this.marshall(params, ['ExpressionAttributeValues', 'ExclusiveStartKey']))
    )
    response.Items = response.Items && response.Items.map(this.unmarshall)
    response.LastEvaluatedKey =
      response.LastEvaluatedKey && this.unmarshall(response.LastEvaluatedKey)
    return response
  }

  async queryAll(params: QueryAllInput): Promise<QueryOutputNative> {
    params = { ...params }
    let result: QueryOutputNative | undefined = undefined
    const queryLimit = params.QueryLimit
    const itemLimit = params.ItemLimit
    delete params.QueryLimit
    delete params.ItemLimit

    let response: QueryOutputNative = {}
    let workRemaining
    do {
      response = await this.query({
        ...params,
        ExclusiveStartKey: response.LastEvaluatedKey,
      })
      // First run
      if (result === undefined) {
        result = response
      } else {
        result.Count = optionalAdd(result.Count, response.Count)
        result.ScannedCount = optionalAdd(result.ScannedCount, response.ScannedCount)
        result.Items = (result?.Items || []).concat(response?.Items || [])
        result.LastEvaluatedKey = response.LastEvaluatedKey
      }
      workRemaining =
        response.LastEvaluatedKey &&
        (queryLimit === undefined || result?.ScannedCount || 0 < queryLimit) &&
        (itemLimit === undefined || result?.Count || 0 < itemLimit)
    } while (workRemaining)

    return result
  }

  async scan(params: ScanInputNative): Promise<ScanOutputNative> {
    const response = await this._dynamo.send(
      new ScanCommand(this.marshall(params, ['ExpressionAttributeValues', 'ExclusiveStartKey']))
    )
    response.Items = response.Items && response.Items.map(this.unmarshall)
    response.LastEvaluatedKey =
      response.LastEvaluatedKey && this.unmarshall(response.LastEvaluatedKey)
    return response
  }

  async scanAll(params: ScanAllInput): Promise<ScanOutputNative> {
    params = { ...params }
    let result: ScanOutput | undefined = undefined
    const scanLimit = params.ScanLimit
    const itemLimit = params.ItemLimit
    delete params.ScanLimit
    delete params.ItemLimit

    let response: ScanOutput = {}
    let workRemaining
    do {
      response = await this.scan({
        ...params,
        ExclusiveStartKey: response.LastEvaluatedKey,
      })
      // First run
      if (result === undefined) {
        result = response
      } else {
        result.Count = optionalAdd(result.Count, response.Count)
        result.ScannedCount = optionalAdd(result.ScannedCount, response.ScannedCount)
        result.Items = (result?.Items || []).concat(response?.Items || [])
        result.LastEvaluatedKey = response.LastEvaluatedKey
      }
      workRemaining =
        response.LastEvaluatedKey &&
        (scanLimit === undefined || result?.ScannedCount || 0 < scanLimit) &&
        (itemLimit === undefined || result?.Count || 0 < itemLimit)
    } while (workRemaining)

    return result
  }

  async get(params: GetItemInputNative): Promise<GetItemOutputNative> {
    const response = await this._dynamo.send(new GetItemCommand(this.marshall(params, ['Key'])))
    response.Item = response.Item && this.unmarshall(response.Item)
    return response
  }
  async put(params: PutItemInputNative): Promise<PutItemOutputNative> {
    const response = await this._dynamo.send(new PutItemCommand(this.marshall(params, ['Item'])))
    response.Attributes = response.Attributes && this.unmarshall(response.Attributes)
    return response
  }
  async update(params: UpdateItemInputNative): Promise<UpdateItemOutputNative> {
    const dynamoParams: UpdateItemInput = this.marshall(
      {
        ...params,
        AttributeUpdates:
          params.AttributeUpdates &&
          Object.fromEntries(
            Object.entries(params.AttributeUpdates).map(
              ([prop, attr]: [string, AttributeValueUpdate]) => [
                prop,
                this.marshall<
                  AttributeValueUpdate,
                  AttributeValueUpdateNative,
                  keyof AttributeValueUpdate
                >(attr, ['Value']),
              ]
            )
          ),
      },
      ['Key']
    )
    const response = await this._dynamo.send(new UpdateItemCommand(dynamoParams))
    response.Attributes = response.Attributes && this.unmarshall(response.Attributes)
    return response
  }
  async delete(params: DeleteItemInputNative): Promise<DeleteItemOutputNative> {
    const response = await this._dynamo.send(new GetItemCommand(this.marshall(params, ['Key'])))
    response.Item = response.Item && this.unmarshall(response.Item)
    return response
  }

  async batchGet(params: BatchGetItemInputNative): Promise<BatchGetItemOutputNative> {
    const dynamoParams: BatchGetItemInput = {
      ...params,
      RequestItems:
        params.RequestItems &&
        Object.fromEntries(
          Object.entries(params.RequestItems).map(([prop, attr]: [string, KeysAndAttributes]) => [
            prop,
            this.marshall<KeysAndAttributes, KeysAndAttributesNative, keyof KeysAndAttributes>(
              attr,
              ['Keys']
            ),
          ])
        ),
    }
    const response = await this._dynamo.send(new BatchGetItemCommand(dynamoParams))
    response.Responses =
      response.Responses &&
      Object.fromEntries(
        Object.entries(response.Responses).map(([table, items]) => [
          table,
          items.map(this.unmarshall),
        ])
      )
    response.UnprocessedKeys =
      response.UnprocessedKeys &&
      Object.fromEntries(
        Object.entries(response.UnprocessedKeys).map(([table, attrs]) => [
          table,
          {
            ...attrs,
            Keys: attrs.Keys?.map(this.unmarshall),
          },
        ])
      )
    return response
  }
  async batchGetAll(params: BatchGetItemAllInput): Promise<BatchGetItemOutputNative> {
    const requestPool: BatchGetItemInputNative['RequestItems'] = {
      ...params.RequestItems,
    }

    const pageSize = params.PageSize
    delete params.PageSize
    const responses: { [key: string]: NativeItem[] } = {}

    while (true) {
      const batch = sliceGetBatch(requestPool, pageSize)
      if (batch === undefined || Object.keys(batch).length === 0) break
      const response = await this.batchGet({
        ...params,
        RequestItems: batch,
      })
      if (response.Responses) {
        eachObj(response.Responses, (table: string, items: NativeItem[]) => {
          if (!responses[table]) responses[table] = []
          responses[table] = responses[table].concat(items)
        })
      }
      const unprocessed =
        response.UnprocessedKeys && Object.keys(response.UnprocessedKeys).length !== 0
          ? response.UnprocessedKeys
          : null
      if (!unprocessed) continue
      eachObj(unprocessed, (table: string, items: KeysAndAttributes) => {
        const processed = this.marshall(items, ['Keys']) as KeysAndAttributes
        if (!processed.Keys) return
        // batchGet unmarshalls, so we have to re-marshal... this marshalling nonsense :facepalm:
        requestPool?.[table].Keys?.push(...processed.Keys)
      })
    }

    return { Responses: responses }
  }

  async batchWrite(params: BatchWriteItemInputNative): Promise<BatchWriteItemOutputNative> {
    const response = await this._dynamo.send(
      new BatchWriteItemCommand({
        ...params,
        RequestItems: params.RequestItems && marshallBatchRequests(this, params.RequestItems),
      })
    )
    response.UnprocessedItems =
      response.UnprocessedItems &&
      Object.fromEntries(
        Object.entries(response.UnprocessedItems).map(
          ([table, requests]: [string, WriteRequest[]]) => [
            table,
            requests.map((request) => ({
              PutRequest: request.PutRequest &&
                request.PutRequest.Item && {
                  Item: this.unmarshall(request.PutRequest.Item),
                },
              DeleteRequest: request.DeleteRequest &&
                request.DeleteRequest.Key && {
                  Key: this.unmarshall(request.DeleteRequest.Key),
                },
            })),
          ]
        )
      )
    return response
  }

  async batchWriteAll(params: BatchWriteItemAllInput): Promise<void> {
    const requestPool = Object.assign({}, params.RequestItems)
    const pageSize = params.PageSize
    delete params.PageSize

    while (true) {
      const batch = sliceWriteBatch(requestPool, pageSize)
      if (batch === undefined || Object.keys(batch).length === 0) return
      const response = await this.batchWrite({
        ...params,
        RequestItems: batch,
      })
      const unprocessed =
        response.UnprocessedItems && Object.keys(response.UnprocessedItems).length !== 0
          ? response.UnprocessedItems
          : null
      if (!unprocessed) continue
      eachObj(unprocessed, (table: string, items: WriteRequestNative[]) => {
        requestPool[table] = requestPool[table].concat(items)
      })
    }
  }
}

// class DynamoButterClient {}

function up(
  dynamoClientOrConfig: DynamoDBClientConfig | DynamoDBClient,
  butterOptions: ButterClientOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    useKeepAlive: true,
  }
): DynamoButterClient {
  if (!dynamoClientOrConfig) throw new Error('"dynamoClientOrConfig" parameter is required')

  let dynamo: DynamoDBClient
  // dynamo methods mean this is a document client
  if (isFunction((dynamoClientOrConfig as DynamoDBClient).send)) {
    dynamo = dynamoClientOrConfig as DynamoDBClient
  } else {
    if (!(dynamoClientOrConfig as DynamoDBClientConfig).region)
      throw new Error('"region" is required when providing a configuration parameter')
    if (butterOptions?.useKeepAlive !== false) {
      dynamo = new DynamoDBClient(dynamoClientOrConfig)
    } else {
      // Load these lazily to avoid performance cost on the happy path
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Agent } = require('https')
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { NodeHttpHandler } = require('@aws-sdk/node-http-handler')
      dynamo = new DynamoDBClient({
        ...dynamoClientOrConfig,
        requestHandler: new NodeHttpHandler({
          httpsAgent: new Agent({ keepAlive: false }),
        }),
      })
    }
  }

  const client = new ButterClient(dynamo, butterOptions)

  return client
}

export { up }
export { up as churn } // you can take my cute aliases from my joyless corpse

function sliceGetBatch(pool: BatchGetItemInputNative['RequestItems'], pageSize = 25) {
  if (!pool) return
  let requestCount = 0
  const batch: { [key: string]: KeysAndAttributesNative } = {}
  // eslint-disable-next-line @typescript-eslint/ban-types
  const tables = Object.keys(pool as {})
  if (tables.length === 0) return
  tables.forEach((tableName) => {
    const table = pool[tableName]
    if (!table?.Keys?.length || requestCount === pageSize) return
    const keys = table.Keys.splice(0, pageSize - requestCount)
    if (keys.length === 0) return
    requestCount += keys.length
    if (!batch[tableName]) batch[tableName] = Object.assign({}, table, { Keys: [] })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    batch[tableName].Keys = batch![tableName].Keys!.concat(keys)
  })
  return batch
}

function sliceWriteBatch(pool: BatchWriteItemInputNative['RequestItems'], pageSize = 25) {
  if (!pool) return
  let requestCount = 0
  const batch: { [key: string]: WriteRequestNative[] } = {}
  // eslint-disable-next-line @typescript-eslint/ban-types
  const tables = Object.keys(pool as {})
  if (tables.length === 0) return
  tables.forEach((tableName) => {
    const table = pool[tableName]
    if (requestCount === pageSize || !table.length) return
    const items = table.splice(0, pageSize - requestCount)
    if (items.length === 0) return
    requestCount += items.length
    batch[tableName] = batch[tableName] !== undefined ? batch[tableName].concat(items) : items
  })
  return batch
}

function eachObj<T extends { [key: string]: K }, K>(obj: T, func: (key: string, val: K) => void) {
  Object.entries(obj).forEach(([key, val]) => func(key, val))
}

function isFunction(func: unknown) {
  return typeof func === 'function'
}

function optionalAdd(...args: (number | undefined)[]): number {
  return args.reduce((sum: number, arg: number | undefined) => (sum += arg || 0), 0)
}

function marshallBatchRequests(
  butterClient: ButterClient,
  requestItems: BatchWriteItemInputNative['RequestItems']
) {
  if (!requestItems) return
  return Object.fromEntries(
    Object.entries(requestItems).map(([table, requests]: [string, WriteRequest[]]) => [
      table,
      requests.map((request: WriteRequest) => ({
        PutRequest:
          request.PutRequest &&
          butterClient.marshall<PutRequest, PutRequestNative, keyof PutRequest>(
            request.PutRequest,
            ['Item']
          ),
        DeleteRequest:
          request.DeleteRequest &&
          butterClient.marshall<DeleteRequest, DeleteRequestNative, keyof DeleteRequest>(
            request.DeleteRequest,
            ['Key']
          ),
      })),
    ])
  )
}
