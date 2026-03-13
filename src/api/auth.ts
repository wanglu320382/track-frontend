/**
 * 登录与用户管理 API
 */
import request from './request'

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  username: string
  nickname?: string
  role: string
}

export const login = (data: LoginRequest) => request.post<{ data: LoginResponse }>('/auth/login', data)
export const logout = () => request.post<{ data: null }>('/auth/logout')

