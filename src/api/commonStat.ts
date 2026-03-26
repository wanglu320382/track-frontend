/**
 * 常用查询管理 API
 */
import request from './request'

export interface CommonStatItem {
  id: number
  datasourceId?: number | null
  title: string
  statText: string
  description?: string
  createTime?: string
  updateTime?: string
}

export interface CommonStatPage {
  records: CommonStatItem[]
  total: number
  size: number
  current: number
  pages: number
}

export const listCommonStat = (datasourceId?: number | null) =>
  request.get<{ data: CommonStatItem[] }>('/commonStat/list', {
    params: datasourceId != null ? { datasourceId } : undefined
  })

export const pageCommonStat = (params: {
  datasourceId?: number | null
  keyword?: string
  pageNum: number
  pageSize: number
}) =>
  request.get<{ data: CommonStatPage }>('/commonStat/page', {
    params: {
      datasourceId: params.datasourceId ?? undefined,
      keyword: params.keyword?.trim() ? params.keyword : undefined,
      pageNum: params.pageNum,
      pageSize: params.pageSize
    }
  })

export const createCommonStat = (payload: {
  datasourceId?: number | null
  title: string
  statText: string
  description?: string
}) => request.post('/commonStat', payload)

export const updateCommonStat = (
  id: number,
  payload: { datasourceId?: number | null; title: string; statText: string; description?: string }
) => request.put(`/commonStat/${id}`, payload)

export const deleteCommonStat = (id: number) => request.delete(`/commonStat/${id}`)
