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
              <el-select v-if="datasourceId && schemas.length" v-model="currentSchema" placeholder="库" filterable style="width: 150px" @change="loadObjects">
                <el-option v-for="s in schemas" :key="s" :label="s" :value="s" />
              </el-select>
              <el-select v-if="objects.length" v-model="objectName" placeholder="快捷选表" filterable style="width: 160px">
                <el-option v-for="t in objects" :key="t.name" :label="t.name" :value="t.name" />
              </el-select>
            </template>
          </div>
        </div>
      </template>
      <div class="query-area">
        <template v-if="!isRedis">
          <div class="stat-tools">
            <el-select
              v-model="selectedCommonStatId"
              placeholder="选择常用查询"
              clearable
              filterable
              style="width: 260px"
              @change="onSelectCommonStat"
            >
              <el-option
                v-for="item in commonStatList"
                :key="item.id"
                :label="item.title"
                :value="item.id"
              />
            </el-select>
            <el-button type="primary" link @click="openSaveDialog">保存为常用</el-button>
            <el-button type="primary" link @click="goCommonStatManage">常用查询管理</el-button>
          </div>
          <div class="stat-row">
            <el-input
              v-model="stat"
              type="textarea"
              :rows="5"
              placeholder="输入 SELECT 语句"
              class="stat-input"
              @keydown.ctrl.enter="runQuery"
            />
            <div class="btn-group">
              <el-button type="primary" @click="runQuery" :loading="loading" class="execute-btn">执行</el-button>
              <el-button type="success" :disabled="!objectName" @click="runObjectQuery" :loading="loading">浏览表数据</el-button>
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
                    popper-class="object-header-tooltip"
                  >
                    <div class="object-header-two-rows object-header-ellipsis">
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
      <el-dialog v-model="saveDialogVisible" title="保存为常用查询" width="480px">
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
            <el-button type="primary" @click="submitSaveCommonStat" :loading="savingCommonStat">保 存</el-button>
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
import { getSchemas, getObjects, getColumns } from '@/api/metadata'
import { executeStat, queryObject, getRedisValue } from '@/api/dataQuery'
import { listCommonStat, createCommonStat, type CommonStatItem } from '@/api/commonStat'
import type { DatasourceConfig } from '@/types/datasource'
import { encryptStat } from '@/utils/statEncrypt'

const router = useRouter()
const route = useRoute()

const datasources = ref<DatasourceConfig[]>([])
const datasourceId = ref<number | null>(null)
const schemas = ref<string[]>([])
const currentSchema = ref<string>('')
const objects = ref<{ name: string }[]>([])
const objectName = ref<string>('')
const stat = ref<string>('')
const loading = ref(false)
const result = ref<{ columns: string[]; rows: Record<string, unknown>[]; total: number } | null>(null)
const columnComments = ref<string[]>([])
const errorMsg = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const lastExecutedStat = ref('')
const lastQueryMode = ref<'stat' | 'object'>('stat')
const lastObjectName = ref('')
const isRedis = computed(() => {
  const ds = datasources.value.find((d) => d.id === datasourceId.value)
  return ds?.type === 'REDIS'
})
const redisKey = ref('')
const redisResult = ref<unknown>(null)

const commonStatList = ref<CommonStatItem[]>([])
const selectedCommonStatId = ref<number | null>(null)
const saveDialogVisible = ref(false)
const savingCommonStat = ref(false)
const saveForm = reactive({
  datasourceId: null as number | null,
  datasourceLabel: '',
  title: '',
  description: ''
})

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/

const getSafeErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message?.trim()) {
    return err.message.trim()
  }
  return fallback
}

const getValidatedObjectName = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (!objects.value.some((t) => t.name === trimmed)) return null
  if (!IDENTIFIER_PATTERN.test(trimmed)) return null
  return trimmed
}

const loadCommonStat = async () => {
  try {
    const dsId = isRedis.value ? undefined : datasourceId.value ?? undefined
    const res = await listCommonStat(dsId ?? undefined)
    commonStatList.value = res.data || []
  } catch {
    // ignore
  }
}

const loadDatasources = async () => {
  const res = await listDatasources()
  datasources.value = res.data || []
}

const onDatasourceChange = async () => {
  selectedCommonStatId.value = null
  currentSchema.value = ''
  schemas.value = []
  objects.value = []
  objectName.value = ''
  stat.value = ''
  result.value = null
  errorMsg.value = ''
  redisKey.value = ''
  redisResult.value = null
  lastQueryMode.value = 'stat'
  lastObjectName.value = ''
  await loadCommonStat()
  if (datasourceId.value && !isRedis.value) {
    try {
      const res = await getSchemas(datasourceId.value)
      schemas.value = res.data || []
      if (schemas.value.length) {
        currentSchema.value = schemas.value[0]
        await loadObjects()
      }
    } catch {
      // ignore
    }
  }
}

const loadObjects = async () => {
  if (!datasourceId.value) return
  try {
    const res = await getObjects(datasourceId.value, currentSchema.value)
    objects.value = (res.data || []).map((t: { name?: string }) => ({ name: t.name || '' }))
  } catch {
    objects.value = []
  }
}

const parseObjectFromStat = (plain: string): { schema: string; objectName: string } | null => {
  const fromMatch = plain.trim().replace(/\s+/g, ' ').match(/\bFROM\s+(?:`?(\w+)`?\.)?`?(\w+)`?/i)
  if (!fromMatch) return null
  const schemaPart = fromMatch[1] ?? ''
  const namePart = fromMatch[2] ?? ''
  return namePart ? { schema: schemaPart, objectName: namePart } : null
}

const loadColumnComments = async (
  dsId: number,
  schema: string,
  objectNameOrNull: string | null,
  columns: string[]
) => {
  const emptyComments = columns.map(() => '')
  if (!objectNameOrNull) {
    columnComments.value = emptyComments
    return
  }
  try {
    const res = await getColumns(dsId, schema, objectNameOrNull)
    const list = (res.data as { columns?: { columnName?: string; columnComment?: string }[] })?.columns || []
    const commentMap = new Map(list.map((c) => [c.columnName ?? '', c.columnComment ?? '']))
    columnComments.value = columns.map((col) => commentMap.get(col) ?? '')
  } catch {
    columnComments.value = emptyComments
  }
}

const runQuery = async () => {
  if (!datasourceId.value) {
    ElMessage.warning('请先选择数据源')
    return
  }
  const statTrim = stat.value.trim()
  if (!statTrim) {
    if (objectName.value) {
      await runObjectQuery()
      return
    }
    ElMessage.warning('请输入查询语句或选择表')
    return
  }
  if (!statTrim.toUpperCase().startsWith('SELECT')) {
    ElMessage.warning('仅支持 SELECT 查询')
    return
  }
  loading.value = true
  result.value = null
  errorMsg.value = ''
  currentPage.value = 1
  lastExecutedStat.value = statTrim
  lastQueryMode.value = 'stat'
  try {
    const encryptedStat = encryptStat(statTrim)
    const res = await executeStat(datasourceId.value, {
      schema: currentSchema.value || undefined,
      stat: encryptedStat ? undefined : statTrim,
      encryptedStat,
      page: 1,
      size: pageSize.value
    })
    result.value = res.data
    const parsed = parseObjectFromStat(statTrim)
    const schema = parsed?.schema?.trim() || currentSchema.value || ''
    const obj = parsed?.objectName ?? null
    await loadColumnComments(datasourceId.value, schema, obj, res.data.columns)
  } catch (e: unknown) {
    const msg = getSafeErrorMessage(e, '查询失败，请稍后重试')
    errorMsg.value = msg
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

const runObjectQuery = async () => {
  const safeName = getValidatedObjectName(objectName.value)
  if (!datasourceId.value || !safeName) {
    ElMessage.warning('请先选择数据源和表')
    return
  }
  loading.value = true
  result.value = null
  errorMsg.value = ''
  currentPage.value = 1
  lastQueryMode.value = 'object'
  lastObjectName.value = safeName
  try {
    const res = await queryObject(datasourceId.value, {
      objectName: safeName,
      schema: currentSchema.value || undefined,
      page: 1,
      size: pageSize.value
    })
    result.value = res.data
    await loadColumnComments(datasourceId.value, currentSchema.value || '', safeName, res.data.columns)
  } catch (e: unknown) {
    const msg = getSafeErrorMessage(e, '查询失败，请稍后重试')
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
    const msg = getSafeErrorMessage(e, '查询失败，请稍后重试')
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

const onSelectCommonStat = (id: number | null) => {
  if (!id) return
  const item = commonStatList.value.find((it) => it.id === id)
  if (item) {
    stat.value = item.statText
  }
}

const openSaveDialog = () => {
  const statTrim = stat.value.trim()
  if (!statTrim) {
    ElMessage.warning('请输入要保存的内容')
    return
  }
  if (!datasourceId.value) {
    ElMessage.warning('请先选择数据源')
    return
  }
  const ds = datasources.value.find((d) => d.id === datasourceId.value)
  saveForm.datasourceId = datasourceId.value
  saveForm.datasourceLabel = ds ? `${ds.name} (${ds.type})` : ''
  saveForm.title = statTrim.split(/\s+/)[0]?.toUpperCase() === 'SELECT' ? statTrim.slice(0, 50) : ''
  saveForm.description = ''
  saveDialogVisible.value = true
}

const submitSaveCommonStat = async () => {
  const statTrim = stat.value.trim()
  if (!statTrim) {
    ElMessage.warning('请输入要保存的内容')
    return
  }
  if (!saveForm.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  savingCommonStat.value = true
  try {
    await createCommonStat({
      datasourceId: saveForm.datasourceId ?? undefined,
      title: saveForm.title.trim(),
      statText: statTrim,
      description: saveForm.description?.trim() || undefined
    })
    ElMessage.success('已保存')
    saveDialogVisible.value = false
    await loadCommonStat()
  } catch (e: unknown) {
    const msg = getSafeErrorMessage(e, '保存失败，请稍后重试')
    ElMessage.error(msg)
  } finally {
    savingCommonStat.value = false
  }
}

const goCommonStatManage = () => {
  router.push('/common-stat')
}

const fetchPage = async (page: number, size: number) => {
  if (!datasourceId.value) return
  if (lastQueryMode.value === 'object') {
    if (!lastObjectName.value) return
    loading.value = true
    errorMsg.value = ''
    try {
      const res = await queryObject(datasourceId.value, {
        objectName: lastObjectName.value,
        schema: currentSchema.value || undefined,
        page,
        size
      })
      result.value = res.data
      await loadColumnComments(datasourceId.value, currentSchema.value || '', lastObjectName.value, res.data.columns)
    } catch (e: unknown) {
      const msg = getSafeErrorMessage(e, '查询失败，请稍后重试')
      errorMsg.value = msg
      ElMessage.error(msg)
    } finally {
      loading.value = false
    }
    return
  }
  if (!lastExecutedStat.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const enc = encryptStat(lastExecutedStat.value)
    const res = await executeStat(datasourceId.value, {
      schema: currentSchema.value || undefined,
      stat: enc ? undefined : lastExecutedStat.value,
      encryptedStat: enc,
      page,
      size
    })
    result.value = res.data
    const parsed = parseObjectFromStat(lastExecutedStat.value)
    const schema = parsed?.schema?.trim() || currentSchema.value || ''
    const obj = parsed?.objectName ?? null
    await loadColumnComments(datasourceId.value, schema, obj, res.data.columns)
  } catch (e: unknown) {
    const msg = getSafeErrorMessage(e, '查询失败，请稍后重试')
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

const getHeaderTooltipContent = (colIdx: number, col: string): string => {
  const comment = columnComments.value[colIdx] ?? ''
  if (!comment.trim()) return col
  return `${comment}\n(${col})`
}

loadDatasources()

onMounted(async () => {
  const q = route.query
  const qDsId = q.datasourceId as string | undefined
  const qObject = q.object as string | undefined
  if (!qDsId || !qObject) return
  await loadDatasources()
  const dsId = Number(qDsId)
  if (!Number.isFinite(dsId)) return
  const targetDs = datasources.value.find((d) => d.id === dsId)
  if (!targetDs) {
    ElMessage.warning('目标数据源不存在或已删除')
    return
  }
  datasourceId.value = dsId
  await onDatasourceChange()
  const targetSchema = ((q.schema as string) ?? '').trim()
  if (targetSchema && currentSchema.value !== targetSchema) {
    currentSchema.value = targetSchema
    await loadObjects()
  }
  if (!objects.value.some((t) => t.name === qObject)) {
    ElMessage.warning('目标表不存在或当前库不匹配')
    return
  }
  objectName.value = qObject
  await runObjectQuery()
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
.stat-tools {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 4px;
}
.stat-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.stat-input {
  flex: 1;
}
.stat-input :deep(textarea) {
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

.object-header-two-rows {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.object-header-ellipsis {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.object-header-ellipsis .header-comment,
.object-header-ellipsis .header-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.object-header-two-rows .header-comment {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.2;
}
.object-header-two-rows .header-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}
</style>

<style>
.object-header-tooltip.el-popper {
  max-width: 420px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
