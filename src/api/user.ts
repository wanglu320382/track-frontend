/**
 * 系统用户管理 API
 */
import request from './request'

export interface SysUser {
  id?: number
  username: string
  nickname?: string
  role: string
  status: number
}

export interface CreateUserRequest {
  username: string
  password: string
  nickname?: string
  role: string
  status: number
}

export interface UpdateUserRequest {
  id: number
  nickname?: string
  role: string
  status: number
}

export const listUsers = () => request.get<{ data: SysUser[] }>('/user/list')
export const createUser = (data: CreateUserRequest) => request.post<{ data: number }>('/user', data)
export const updateUser = (data: UpdateUserRequest) => request.put<{ data: null }>('/user', data)
export const resetPassword = (id: number, password: string) =>
  request.post<{ data: null }>(`/user/resetPassword/${id}`, { password })
export const deleteUser = (id: number) => request.delete<{ data: null }>(`/user/${id}`)

