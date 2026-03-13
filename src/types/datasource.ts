/**
 * 数据源配置类型定义
 */
export interface DatasourceConfig {
  id?: number
  name: string
  type: 'ORACLE' | 'MYSQL' | 'OCEANBASE_MYSQL' | 'OCEANBASE_ORACLE' | 'REDIS'
  host: string
  port: number
  databaseName?: string
  username?: string
  password?: string
  extraParams?: string
  status?: number
  createTime?: string
  updateTime?: string
}
