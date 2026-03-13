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
    const msg = err.response?.data?.message || err.message || '请求失败'
    return Promise.reject(new Error(msg))
  }
)

/** 封装后实际返回的是 body，类型为 Promise<T> */
interface RequestInstance {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
}

const request = instance as unknown as RequestInstance
export default request
