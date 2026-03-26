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

export interface ExecuteStatParams {
  stat?: string
  encryptedStat?: string
  schema?: string
  page?: number
  size?: number
}

export const executeStat = (datasourceId: number, params: ExecuteStatParams) =>
  request.post<{ data: QueryResult }>(`/query/stat/${datasourceId}`, params)

export const queryObject = (datasourceId: number, params: { objectName: string; schema?: string; where?: string; page?: number; size?: number }) =>
  request.get<{ data: QueryResult }>(`/query/object/${datasourceId}`, { params })

export const getRedisValue = (datasourceId: number, key: string) =>
  request.get<{ data: unknown }>(`/query/redis/${datasourceId}`, { params: { key } })
