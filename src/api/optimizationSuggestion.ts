/**
 * 优化建议 API
 */
import request from './request'

export const OPTIMIZATION_STATUSES = ['审核中', '开发中', '已上线', '不优化'] as const
export type OptimizationStatus = (typeof OPTIMIZATION_STATUSES)[number]

export interface OptimizationSuggestionItem {
  id: number
  title: string
  painPoint: string
  improvementSuggestion: string
  proposer: string
  status: OptimizationStatus | string
  createTime?: string
  updateTime?: string
}

export interface OptimizationSuggestionPage {
  records: OptimizationSuggestionItem[]
  total: number
  size: number
  current: number
  pages: number
}

export const pageOptimizationSuggestion = (params: {
  keyword?: string
  status?: string
  pageNum: number
  pageSize: number
}) =>
  request.get<{ data: OptimizationSuggestionPage }>('/optimizationSuggestion/page', {
    params: {
      keyword: params.keyword?.trim() ? params.keyword : undefined,
      status: params.status?.trim() ? params.status : undefined,
      pageNum: params.pageNum,
      pageSize: params.pageSize
    }
  })

export const createOptimizationSuggestion = (payload: {
  title: string
  painPoint: string
  improvementSuggestion: string
  proposer: string
}) => request.post('/optimizationSuggestion', payload)

export const updateOptimizationSuggestion = (
  id: number,
  payload: {
    title: string
    painPoint: string
    improvementSuggestion: string
    proposer: string
    status: string
  }
) => request.put(`/optimizationSuggestion/${id}`, payload)

export const deleteOptimizationSuggestion = (id: number) =>
  request.delete(`/optimizationSuggestion/${id}`)
