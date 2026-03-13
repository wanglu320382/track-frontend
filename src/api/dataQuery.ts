/**
 * 数据查询 API
 */
import request from './request'

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  page: number
  size: number
}

export interface ExecuteSqlParams {
  sql?: string
  encryptedSql?: string
  schema?: string
  page?: number
  size?: number
}

export const executeSql = (datasourceId: number, params: ExecuteSqlParams) =>
  request.post<{ data: QueryResult }>(`/query/sql/${datasourceId}`, params)

export const queryTable = (datasourceId: number, params: { tableName: string; schema?: string; where?: string; page?: number; size?: number }) =>
  request.get<{ data: QueryResult }>(`/query/table/${datasourceId}`, { params })

export const getRedisValue = (datasourceId: number, key: string) =>
  request.get<{ data: unknown }>(`/query/redis/${datasourceId}`, { params: { key } })
