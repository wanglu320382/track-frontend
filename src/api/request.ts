/**
 * Axios 请求封装
 * 响应拦截器返回 body（res.data），故请求方法在类型上返回 Promise<T>（T 为接口 body 类型）
 */
import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosRequestConfig } from 'axios'

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 30000,
})

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers = config.headers || {}
    config.headers['X-Auth-Token'] = token
  }
  return config
})

instance.interceptors.response.use(
  (res) => {
    const data = res.data
    // 后端返回 code !== 200 时也视为错误，便于展示错误信息
    if (data && typeof data === 'object' && data.code !== undefined && data.code !== 200) {
      const msg = data.message || '请求失败'
      return Promise.reject(new Error(msg))
    }
    return data
  },
  (err) => {
    const msg = resolveErrorMessage(err)
    return Promise.reject(new Error(msg))
  }
)

/**
 * 从不同后端/网关错误体中提取可展示信息，避免退化为 status code 文案。
 */
const resolveErrorMessage = (err: unknown): string => {
  const fallback = '请求失败'
  if (err == null || typeof err !== 'object') {
    return fallback
  }

  const errorObj = err as {
    message?: unknown
    response?: {
      data?: unknown
      statusText?: unknown
    }
  }
  const body = errorObj.response?.data

  if (typeof body === 'string' && body.trim()) {
    return body.trim()
  }
  if (body && typeof body === 'object') {
    const dataObj = body as Record<string, unknown>
    const candidates = [dataObj.message, dataObj.msg, dataObj.error]
    for (const item of candidates) {
      if (typeof item === 'string' && item.trim()) {
        return item.trim()
      }
    }
  }
  if (typeof errorObj.message === 'string' && errorObj.message.trim()) {
    return errorObj.message.trim()
  }
  if (typeof errorObj.response?.statusText === 'string' && errorObj.response.statusText.trim()) {
    return errorObj.response.statusText.trim()
  }
  return fallback
}

/** 封装后实际返回的是 body，类型为 Promise<T> */
interface RequestInstance {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
}

const request = instance as unknown as RequestInstance
export default request
