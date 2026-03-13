/**
 * 常用 SQL 管理 API
 */
import request from './request'

export interface CommonSqlItem {
  id: number
  datasourceId?: number | null
  title: string
  sqlText: string
  description?: string
  createTime?: string
  updateTime?: string
}

/** 获取常用 SQL 列表，datasourceId 可选，传入时只返回该数据源下的 SQL */
export const listCommonSql = (datasourceId?: number | null) =>
  request.get<{ data: CommonSqlItem[] }>('/commonSql/list', {
    params: datasourceId != null ? { datasourceId } : undefined
  })

export const createCommonSql = (payload: {
  datasourceId?: number | null
  title: string
  sqlText: string
  description?: string
}) => request.post('/commonSql', payload)

export const updateCommonSql = (
  id: number,
  payload: { datasourceId?: number | null; title: string; sqlText: string; description?: string }
) => request.put(`/commonSql/${id}`, payload)

export const deleteCommonSql = (id: number) => request.delete(`/commonSql/${id}`)

