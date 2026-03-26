/**
 * 元数据 API - 库、表、列结构
 */
import request from './request'

export const getSchemas = (datasourceId: number) =>
  request.get<{ data: string[] }>(`/metadata/schemas/${datasourceId}`)

export const getObjects = (datasourceId: number, schema?: string) =>
  request.get<{ data: { name: string; comment: string }[] }>(`/metadata/objects/${datasourceId}`, { params: schema ? { schema } : {} })

export const getColumns = (datasourceId: number, schema: string, objectName: string) =>
  request.get<{ data: { objectName?: string; objectComment?: string; columns?: Record<string, unknown>[] } }>(`/metadata/columns/${datasourceId}`, {
    params: { schema, objectName },
  })

export const getRedisKeys = (datasourceId: number, pattern?: string) =>
  request.get<{ data: string[] }>(`/metadata/redis/keys/${datasourceId}`, { params: { pattern: pattern || '*' } })

export const getRedisKeyInfo = (datasourceId: number, key: string) =>
  request.get<{ data: { type: string; value: unknown } }>(`/metadata/redis/key/${datasourceId}`, { params: { key } })
