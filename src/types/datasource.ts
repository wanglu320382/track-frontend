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
  /** Oracle：SID（默认）或 SERVICE_NAME */
  oracleConnectMode?: 'SID' | 'SERVICE_NAME'
  username?: string
  password?: string
  extraParams?: string
  status?: number
  createTime?: string
  updateTime?: string
}
