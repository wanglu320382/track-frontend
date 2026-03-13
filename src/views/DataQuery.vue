<template>
  <div class="data-query">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>数据查询</span>
          <div class="header-actions">
            <el-select v-model="datasourceId" placeholder="选择数据源" filterable style="width: 200px" @change="onDatasourceChange">
              <el-option v-for="ds in datasources" :key="ds.id" :label="`${ds.name} (${ds.type})`" :value="ds.id" />
            </el-select>
            <template v-if="!isRedis">
              <el-select v-if="datasourceId && schemas.length" v-model="currentSchema" placeholder="库" filterable style="width: 150px" @change="loadTables">
                <el-option v-for="s in schemas" :key="s" :label="s" :value="s" />
              </el-select>
              <el-select v-if="tables.length" v-model="tableName" placeholder="快捷选表" filterable style="width: 160px" @change="fillSql">
                <el-option v-for="t in tables" :key="t.name" :label="t.name" :value="t.name" />
              </el-select>
            </template>
          </div>
        </div>
      </template>
      <div class="query-area">
        <!-- 关系型：SQL + 表数据浏览 -->
        <template v-if="!isRedis">
          <div class="sql-tools">
            <el-select
              v-model="selectedCommonSqlId"
              placeholder="选择常用 SQL"
              clearable
              filterable
              style="width: 260px"
              @change="onSelectCommonSql"
            >
              <el-option
                v-for="item in commonSqlList"
                :key="item.id"
                :label="item.title"
                :value="item.id"
              />
            </el-select>
            <el-button type="primary" link @click="openSaveDialog">保存为常用 SQL</el-button>
            <el-button type="primary" link @click="goCommonSqlManage">常用 SQL 管理</el-button>
          </div>
          <div class="sql-row">
            <el-input
              v-model="sql"
              type="textarea"
              :rows="5"
              placeholder="输入 SELECT 语句，如：SELECT * FROM datasource_config LIMIT 100"
              class="sql-input"
              @keydown.ctrl.enter="runQuery"
            />
            <div class="btn-group">
              <el-button type="primary" @click="runQuery" :loading="loading" class="execute-btn">执行 SQL</el-button>
              <el-button type="success" :disabled="!tableName" @click="runTableQuery" :loading="loading">浏览表数据</el-button>
            </div>
          </div>
          <el-alert v-if="errorMsg" type="error" :title="errorMsg" show-icon closable class="error-alert" @close="errorMsg = ''" />
          <div class="result-area" v-if="result">
            <el-table :data="result.rows" stripe border max-height="420">
              <el-table-column v-for="(col, colIdx) in result.columns" :key="col" :prop="col" min-width="120" show-overflow-tooltip>
                <template #header>
                  <el-tooltip
                    :content="getHeaderTooltipContent(colIdx, col)"
                    placement="top"
                    effect="dark"
                    popper-class="table-header-tooltip"
                  >
                    <div class="table-header-two-rows table-header-ellipsis">
                      <div class="header-comment">{{ columnComments[colIdx] ?? '' }}</div>
                      <div class="header-name">{{ col }}</div>
                    </div>
                  </el-tooltip>
                </template>
              </el-table-column>
            </el-table>
            <div class="pagination-wrap">
              <el-pagination
                v-model:current-page="currentPage"
                :page-size="pageSize"
                :total="result.total"
                :page-sizes="[20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                @current-change="onPageChange"
                @size-change="onSizeChange"
              />
            </div>
          </div>
        </template>
        <!-- Redis：Key 查询 -->
        <template v-else>
          <div class="redis-row">
            <el-input v-model="redisKey" placeholder="输入 Redis Key，如：user:10001 或 config:api:*" clearable class="redis-key-input" @keyup.enter="runRedisQuery" />
            <el-button type="primary" @click="runRedisQuery" :loading="loading">查询 Key</el-button>
          </div>
          <el-alert v-if="errorMsg" type="error" :title="errorMsg" show-icon closable class="error-alert" @close="errorMsg = ''" />
          <div class="result-area redis-result" v-if="redisResult !== null">
            <div class="redis-value-block">
              <pre class="redis-value-pre">{{ formatRedisValue(redisResult) }}</pre>
            </div>
          </div>
        </template>
      </div>
      <el-dialog v-model="saveDialogVisible" title="保存为常用 SQL" width="480px">
        <el-form :model="saveForm" label-width="80px">
          <el-form-item label="数据源">
            <el-input :model-value="saveForm.datasourceLabel" disabled placeholder="当前数据源" />
          </el-form-item>
          <el-form-item label="标题">
            <el-input v-model="saveForm.title" placeholder="请输入标题" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="saveForm.description" type="textarea" :rows="2" placeholder="可选，简单说明用途" />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="saveDialogVisible = false">取 消</el-button>
            <el-button type="primary" @click="submitSaveCommonSql" :loading="savingCommonSql">保 存</el-button>
          </span>
        </template>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { listDatasources } from '@/api/datasource'
import { getSchemas, getTables, getColumns } from '@/api/metadata'
import { executeSql, queryTable, getRedisValue } from '@/api/dataQuery'
import { listCommonSql, createCommonSql, type CommonSqlItem } from '@/api/commonSql'
import type { DatasourceConfig } from '@/types/datasource'
import { encryptSql } from '@/utils/sqlEncrypt'

const router = useRouter()
const route = useRoute()

const datasources = ref<DatasourceConfig[]>([])
const datasourceId = ref<number | null>(null)
const schemas = ref<string[]>([])
const currentSchema = ref<string>('')
const tables = ref<{ name: string }[]>([])
const tableName = ref<string>('')
const sql = ref<string>('')
const loading = ref(false)
const result = ref<{ columns: string[]; rows: Record<string, unknown>[]; total: number } | null>(null)
/** 与 result.columns 一一对应的字段中文注释，无注释则为空字符串 */
const columnComments = ref<string[]>([])
const errorMsg = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const lastExecutedSql = ref('')
/** 'sql' | 'table'：分页时用哪个接口 */
const lastQueryMode = ref<'sql' | 'table'>('sql')
const lastTableName = ref('')
const isRedis = computed(() => {
  const ds = datasources.value.find((d) => d.id === datasourceId.value)
  return ds?.type === 'REDIS'
})
const redisKey = ref('')
const redisResult = ref<unknown>(null)

const commonSqlList = ref<CommonSqlItem[]>([])
const selectedCommonSqlId = ref<number | null>(null)
const saveDialogVisible = ref(false)
const savingCommonSql = ref(false)
const saveForm = reactive({
  datasourceId: null as number | null,
  datasourceLabel: '',
  title: '',
  description: ''
})

/** 只加载当前数据源下的常用 SQL，实现与数据源下拉框联动 */
const loadCommonSql = async () => {
  try {
    const dsId = isRedis.value ? undefined : datasourceId.value ?? undefined
    const res = await listCommonSql(dsId ?? undefined)
    commonSqlList.value = res.data || []
  } catch {
    // ignore
  }
}

const loadDatasources = async () => {
  const res = await listDatasources()
  datasources.value = res.data || []
}

const onDatasourceChange = async () => {
  selectedCommonSqlId.value = null
  currentSchema.value = ''
  schemas.value = []
  tables.value = []
  tableName.value = ''
  sql.value = ''
  result.value = null
  errorMsg.value = ''
  redisKey.value = ''
  redisResult.value = null
  lastQueryMode.value = 'sql'
  lastTableName.value = ''
  await loadCommonSql()
  if (datasourceId.value && !isRedis.value) {
    try {
      const res = await getSchemas(datasourceId.value)
      schemas.value = res.data || []
      if (schemas.value.length) {
        currentSchema.value = schemas.value[0]
        await loadTables()
      }
    } catch {
      // ignore
    }
  }
}

const loadTables = async () => {
  if (!datasourceId.value) return
  try {
    const res = await getTables(datasourceId.value, currentSchema.value)
    tables.value = (res.data || []).map((t: { name?: string }) => ({ name: t.name || '' }))
  } catch {
    tables.value = []
  }
}

/** 从 SELECT 语句中解析 FROM 后的第一个表名（支持 schema.table 或 table） */
const parseTableFromSql = (sql: string): { schema: string; tableName: string } | null => {
  const fromMatch = sql.trim().replace(/\s+/g, ' ').match(/\bFROM\s+(?:`?(\w+)`?\.)?`?(\w+)`?/i)
  if (!fromMatch) return null
  const schema = fromMatch[1] ?? ''
  const tableName = fromMatch[2] ?? ''
  return tableName ? { schema, tableName } : null
}

/** 根据当前结果列与表名加载字段注释（有表名则拉取元数据，否则全部为空） */
const loadColumnComments = async (
  dsId: number,
  schema: string,
  tableNameOrNull: string | null,
  columns: string[]
) => {
  const emptyComments = columns.map(() => '')
  if (!tableNameOrNull) {
    columnComments.value = emptyComments
    return
  }
  try {
    const res = await getColumns(dsId, schema, tableNameOrNull)
    const list = (res.data as { columns?: { columnName?: string; columnComment?: string }[] })?.columns || []
    const commentMap = new Map(list.map((c) => [c.columnName ?? '', c.columnComment ?? '']))
    columnComments.value = columns.map((col) => commentMap.get(col) ?? '')
  } catch {
    columnComments.value = emptyComments
  }
}

const fillSql = () => {
  if (!tableName.value) return
  const ds = datasources.value.find((d) => d.id === datasourceId.value)
  const type = (ds?.type ?? '').toUpperCase()
  // Oracle / OceanBase Oracle 不支持 LIMIT，用 ROWNUM 或不分页的写法
  if (type === 'ORACLE' || type.includes('OCEANBASE') && type.includes('ORACLE')) {
    sql.value = `SELECT * FROM ${tableName.value} WHERE ROWNUM <= 100`
  } else {
    sql.value = `SELECT * FROM ${tableName.value} LIMIT 100`
  }
}

const runQuery = async () => {
  if (!datasourceId.value) {
    ElMessage.warning('请先选择数据源')
    return
  }
  if (!sql.value.trim() && tableName.value) {
    fillSql()
  }
  const sqlTrim = sql.value.trim()
  if (!sqlTrim) {
    ElMessage.warning('请输入 SQL 或选择表')
    return
  }
  if (!sqlTrim.toUpperCase().startsWith('SELECT')) {
    ElMessage.warning('仅支持 SELECT 查询')
    return
  }
  loading.value = true
  result.value = null
  errorMsg.value = ''
  currentPage.value = 1
  lastExecutedSql.value = sqlTrim
  lastQueryMode.value = 'sql'
  try {
    const res = await executeSql(datasourceId.value, {
      schema: currentSchema.value || undefined,
      encryptedSql: encryptSql(sqlTrim),
      page: 1,
      size: pageSize.value
    })
    result.value = res.data
    const parsed = parseTableFromSql(sqlTrim)
    // 表名无用户/schema 前缀时用当前选中的库，才能正确查到列中文注释
    const schema = parsed?.schema?.trim() || currentSchema.value || ''
    const table = parsed?.tableName ?? null
    await loadColumnComments(datasourceId.value, schema, table, res.data.columns)
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '查询失败'
    errorMsg.value = msg
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

const runTableQuery = async () => {
  if (!datasourceId.value || !tableName.value) {
    ElMessage.warning('请先选择数据源和表')
    return
  }
  loading.value = true
  result.value = null
  errorMsg.value = ''
  currentPage.value = 1
  lastQueryMode.value = 'table'
  lastTableName.value = tableName.value
  try {
    const res = await queryTable(datasourceId.value, {
      tableName: tableName.value,
      schema: currentSchema.value || undefined,
      page: 1,
      size: pageSize.value
    })
    result.value = res.data
    await loadColumnComments(datasourceId.value, currentSchema.value || '', tableName.value, res.data.columns)
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '查询失败'
    errorMsg.value = msg
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

const runRedisQuery = async () => {
  const key = redisKey.value?.trim()
  if (!datasourceId.value) {
    ElMessage.warning('请先选择数据源')
    return
  }
  if (!key) {
    ElMessage.warning('请输入 Redis Key')
    return
  }
  loading.value = true
  redisResult.value = null
  errorMsg.value = ''
  try {
    const res = await getRedisValue(datasourceId.value, key)
    redisResult.value = res.data
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '查询失败'
    errorMsg.value = msg
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

const formatRedisValue = (val: unknown): string => {
  if (val == null) return '(空)'
  if (typeof val === 'object') return JSON.stringify(val, null, 2)
  return String(val)
}

const onSelectCommonSql = (id: number | null) => {
  if (!id) return
  const item = commonSqlList.value.find((it) => it.id === id)
  if (item) {
    sql.value = item.sqlText
  }
}

const openSaveDialog = () => {
  const sqlTrim = sql.value.trim()
  if (!sqlTrim) {
    ElMessage.warning('请输入要保存的 SQL')
    return
  }
  if (!datasourceId.value) {
    ElMessage.warning('请先选择数据源')
    return
  }
  const ds = datasources.value.find((d) => d.id === datasourceId.value)
  saveForm.datasourceId = datasourceId.value
  saveForm.datasourceLabel = ds ? `${ds.name} (${ds.type})` : ''
  saveForm.title = sqlTrim.split(/\s+/)[0]?.toUpperCase() === 'SELECT' ? sqlTrim.slice(0, 50) : ''
  saveForm.description = ''
  saveDialogVisible.value = true
}

const submitSaveCommonSql = async () => {
  const sqlTrim = sql.value.trim()
  if (!sqlTrim) {
    ElMessage.warning('请输入要保存的 SQL')
    return
  }
  if (!saveForm.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  savingCommonSql.value = true
  try {
    await createCommonSql({
      datasourceId: saveForm.datasourceId ?? undefined,
      title: saveForm.title.trim(),
      sqlText: sqlTrim,
      description: saveForm.description?.trim() || undefined
    })
    ElMessage.success('已保存为常用 SQL')
    saveDialogVisible.value = false
    await loadCommonSql()
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '保存失败'
    ElMessage.error(msg)
  } finally {
    savingCommonSql.value = false
  }
}

const goCommonSqlManage = () => {
  router.push('/common-sql')
}

const fetchPage = async (page: number, size: number) => {
  if (!datasourceId.value) return
  if (lastQueryMode.value === 'table') {
    if (!lastTableName.value) return
    loading.value = true
    errorMsg.value = ''
    try {
      const res = await queryTable(datasourceId.value, {
        tableName: lastTableName.value,
        schema: currentSchema.value || undefined,
        page,
        size
      })
      result.value = res.data
      await loadColumnComments(datasourceId.value, currentSchema.value || '', lastTableName.value, res.data.columns)
    } catch (e: unknown) {
      const msg = (e as Error)?.message || '查询失败'
      errorMsg.value = msg
      ElMessage.error(msg)
    } finally {
      loading.value = false
    }
    return
  }
  if (!lastExecutedSql.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await executeSql(datasourceId.value, {
      schema: currentSchema.value || undefined,
      encryptedSql: encryptSql(lastExecutedSql.value),
      page,
      size
    })
    result.value = res.data
    const parsed = parseTableFromSql(lastExecutedSql.value)
    const schema = parsed?.schema?.trim() || currentSchema.value || ''
    const table = parsed?.tableName ?? null
    await loadColumnComments(datasourceId.value, schema, table, res.data.columns)
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '查询失败'
    errorMsg.value = msg
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

const onPageChange = (page: number) => {
  fetchPage(page, pageSize.value)
}

const onSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
  fetchPage(1, size)
}

/** 表头悬停浮层显示的完整内容（注释 + 字段名），用于长标题浮空放大 */
const getHeaderTooltipContent = (colIdx: number, col: string): string => {
  const comment = columnComments.value[colIdx] ?? ''
  if (!comment.trim()) return col
  return `${comment}\n(${col})`
}

loadDatasources()

/** 从表结构页跳转时带上的数据源、库、表，自动填充并执行浏览表数据 */
onMounted(async () => {
  const q = route.query
  const qDsId = q.datasourceId as string | undefined
  const qTable = q.table as string | undefined
  if (!qDsId || !qTable) return
  await loadDatasources()
  const dsId = Number(qDsId)
  if (!Number.isFinite(dsId)) return
  datasourceId.value = dsId
  await onDatasourceChange()
  currentSchema.value = (q.schema as string) ?? ''
  tableName.value = qTable
  await runTableQuery()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.query-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sql-tools {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 4px;
}
.sql-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.sql-input {
  flex: 1;
}
.sql-input :deep(textarea) {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}
.btn-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}
.execute-btn {
  min-width: 100px;
}
.redis-row {
  display: flex;
  gap: 12px;
  align-items: center;
}
.redis-key-input {
  max-width: 400px;
}
.redis-value-block {
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  max-height: 400px;
  overflow: auto;
}
.redis-value-pre {
  margin: 0;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
}
.error-alert {
  margin-bottom: 12px;
}
.error-alert :deep(.el-alert__title) {
  word-break: break-all;
}
.result-area {
  margin-top: 8px;
}
.pagination-wrap {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

/* 表头两行：上方中文注释，下方英文字段名 */
.table-header-two-rows {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.table-header-ellipsis {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.table-header-ellipsis .header-comment,
.table-header-ellipsis .header-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.table-header-two-rows .header-comment {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.2;
}
.table-header-two-rows .header-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}
</style>

<style>
/* 表头浮层：浮空放大显示完整标题，非 scoped 以便作用于 el-tooltip 的 popper */
.table-header-tooltip.el-popper {
  max-width: 420px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
