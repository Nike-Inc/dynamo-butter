import { marshall } from '@aws-sdk/util-dynamodb'
export { unmarshall } from '@aws-sdk/util-dynamodb'

import type {
  NativeAttributeValue,
  marshallOptions,
} from '@aws-sdk/util-dynamodb'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import type {
  QueryInput,
  QueryOutput,
  ScanInput,
  ScanOutput,
  GetItemInput,
  GetItemOutput,
  PutItemInput,
  PutItemOutput,
  UpdateItemInput,
  UpdateItemOutput,
  AttributeValueUpdate,
  ExpectedAttributeValue,
  DeleteItemInput,
  DeleteItemOutput,
  BatchGetItemInput,
  BatchGetItemOutput,
  BatchWriteItemInput,
  BatchWriteItemOutput,
  KeysAndAttributes,
} from '@aws-sdk/client-dynamodb'

export interface Marshallable {
  [key: string]: unknown
}

export interface MarshalledItem {
  [key: string]: AttributeValue
}

export interface NativeItem {
  [key: string]: NativeAttributeValue
}

export { marshall }

export function marshalKeys<
  T extends Marshallable,
  K extends T,
  S extends keyof T
>(params: K, keys: S[], options?: marshallOptions): T {
  // return (keys as unknown[]).reduce(
  return keys.reduce(
    (output: T, key: S): T => {
      output[key] = params[key]
        ? (marshall(params[key], options) as NativeAttributeValue)
        : undefined
      return output
    },
    { ...params } as T
  ) as T
}

// Re-Marshalled Types
//

export interface QueryInputNative
  extends Omit<QueryInput, 'ExpressionAttributeValues' | 'ExclusiveStartKey'> {
  ExpressionAttributeValues?: NativeItem
  ExclusiveStartKey?: NativeItem
}

export interface QueryOutputNative
  extends Omit<QueryOutput, 'Items' | 'LastEvaluatedKey'> {
  Items?: NativeItem[]
  LastEvaluatedKey?: NativeItem
}

export interface ScanInputNative
  extends Omit<ScanInput, 'ExpressionAttributeValues' | 'ExclusiveStartKey'> {
  ExpressionAttributeValues?: NativeItem
  ExclusiveStartKey?: NativeItem
}

export interface ScanOutputNative
  extends Omit<ScanOutput, 'Items' | 'LastEvaluatedKey'> {
  Items?: NativeItem[]
  LastEvaluatedKey?: NativeItem
}

export interface GetItemInputNative extends Omit<GetItemInput, 'Key'> {
  Key: NativeItem | undefined
}

export interface GetItemOutputNative extends Omit<GetItemOutput, 'Item'> {
  Item?: NativeItem | undefined
}

export interface PutItemInputNative
  extends Omit<PutItemInput, 'Item' | 'ExpressionAttributeValues'> {
  Item: NativeItem | undefined
  ExpressionAttributeValues?: NativeItem
}

export interface PutItemOutputNative extends Omit<PutItemOutput, 'Attributes'> {
  Attributes?: NativeItem
}

export interface AttributeValueUpdateNative
  extends Omit<AttributeValueUpdate, 'Value'> {
  Value?: NativeAttributeValue
}

export interface ExpectedAttributeValueNative
  extends Omit<ExpectedAttributeValue, 'Value' | 'AttributeValueList'> {
  Value?: NativeAttributeValue
  AttributeValueList?: NativeAttributeValue[]
}

export interface UpdateItemInputNative
  extends Omit<
    UpdateItemInput,
    'Key' | 'ExpressionAttributeValues' | 'AttributeUpdates'
  > {
  Key: NativeItem | undefined
  ExpressionAttributeValues?: NativeItem
  AttributeUpdates?: AttributeValueUpdateNative
}

export interface UpdateItemOutputNative
  extends Omit<UpdateItemOutput, 'Attributes'> {
  Attributes?: NativeItem
}

export interface DeleteItemInputNative
  extends Omit<
    DeleteItemInput,
    'Key' | 'Expected' | 'ExpressionAttributeValues'
  > {
  Key: NativeItem | undefined
  Expected?: ExpectedAttributeValueNative
  ExpressionAttributeValues?: NativeItem
}

export interface DeleteItemOutputNative
  extends Omit<DeleteItemOutput, 'Attributes'> {
  Attributes?: NativeItem
}

export interface KeysAndAttributesNative
  extends Omit<KeysAndAttributes, 'Keys'> {
  Keys: NativeItem[] | undefined
}

export interface BatchGetItemInputNative
  extends Omit<BatchGetItemInput, 'RequestItems'> {
  RequestItems:
    | {
        [key: string]: KeysAndAttributesNative
      }
    | undefined
}

export interface BatchGetItemOutputNative
  extends Omit<BatchGetItemOutput, 'Responses' | 'UnprocessedKeys'> {
  Responses?: {
    [key: string]: NativeItem[]
  }
  UnprocessedKeys?: {
    [key: string]: KeysAndAttributesNative
  }
}

export interface PutRequestNative {
  Item: NativeItem | undefined
}

export interface DeleteRequestNative {
  Key: NativeItem | undefined
}

export interface WriteRequestNative {
  PutRequest?: PutRequestNative
  DeleteRequest?: DeleteRequestNative
}

export interface BatchWriteItemInputNative
  extends Omit<BatchWriteItemInput, 'RequestItems'> {
  RequestItems:
    | {
        [key: string]: WriteRequestNative[]
      }
    | undefined
}

export interface BatchWriteItemOutputNative
  extends Omit<BatchWriteItemOutput, 'UnprocessedItems'> {
  UnprocessedItems?: {
    [key: string]: WriteRequestNative[]
  }
}
