/**
 * 数据源管理 API
 */
import request from './request'
import type { DatasourceConfig } from '@/types/datasource'

export type { DatasourceConfig }

export const listDatasources = () => request.get<{ data: DatasourceConfig[] }>('/datasource/list')
export const getDatasource = (id: number) => request.get<{ data: DatasourceConfig }>(`/datasource/${id}`)
export const saveDatasource = (data: DatasourceConfig) => request.post<{ data: number }>('/datasource', data)
export const updateDatasource = (data: DatasourceConfig) => request.put<{ data: null }>('/datasource', data)
export const removeDatasource = (id: number) => request.delete<{ data: null }>(`/datasource/${id}`)
export const testDatasource = (id: number) => request.post<{ data: boolean }>(`/datasource/test/${id}`)
