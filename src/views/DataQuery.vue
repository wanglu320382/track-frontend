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
          <el-tabs
            v-model="activeTabId"
            type="card"
            class="query-tabs"
            addable
            @tab-add="addSqlTab"
            @tab-remove="onTabRemove"
          >
            <template #add-icon>
              <el-button type="primary" class="add-query-tab-btn">
                <el-icon class="add-query-tab-icon"><Plus /></el-icon>
                <span>新建查询</span>
              </el-button>
            </template>
            <el-tab-pane
              v-for="tab in sqlTabs"
              :key="tab.id"
              :label="tab.title"
              :name="tab.id"
              :closable="sqlTabs.length > 1"
            >
              <div class="stat-tools">
                <el-select
                  v-model="tab.selectedCommonStatId"
                  placeholder="选择常用查询"
                  clearable
                  filterable
                  style="width: 260px"
                  @change="(id) => onSelectCommonStat(tab, id)"
                >
                  <el-option
                    v-for="item in commonStatList"
                    :key="item.id"
                    :label="item.title"
                    :value="item.id"
                  />
                </el-select>
                <el-button type="primary" link @click="openSaveDialog(tab)">保存为常用</el-button>
                <el-button type="primary" link @click="goCommonStatManage">常用查询管理</el-button>
              </div>
              <div class="stat-row">
                <el-input
                  :ref="(el) => setStatInputRef(tab.id, el)"
                  v-model="tab.stat"
                  type="textarea"
                  :rows="5"
                  placeholder="输入 SELECT 语句"
                  class="stat-input"
                  @keydown.ctrl.enter="runQuery(tab)"
                />
                <div class="btn-group">
                  <el-button type="primary" @click="runQuery(tab)" :loading="loadingTabId === tab.id" class="execute-btn">执行</el-button>
                  <el-button type="success" :disabled="!objectName" @click="runObjectQuery(tab)" :loading="loadingTabId === tab.id">浏览表数据</el-button>
                </div>
              </div>
              <el-alert v-if="tab.errorMsg" type="error" :title="tab.errorMsg" show-icon closable class="error-alert" @close="tab.errorMsg = ''" />
              <div class="result-area" v-if="tab.result">
                <el-table :data="tab.result.rows" stripe border max-height="420">
                  <el-table-column v-for="(col, colIdx) in tab.result.columns" :key="col" :prop="col" min-width="120" show-overflow-tooltip>
                    <template #header>
                      <el-tooltip
                        :content="getHeaderTooltipContent(tab, colIdx, col)"
                        placement="top"
                        effect="dark"
                        popper-class="object-header-tooltip"
                      >
                        <div class="object-header-two-rows object-header-ellipsis">
                          <div class="header-comment">{{ tab.columnComments[colIdx] ?? '' }}</div>
                          <div class="header-name">{{ col }}</div>
                        </div>
                      </el-tooltip>
                    </template>
                  </el-table-column>
                </el-table>
                <div class="pagination-wrap">
                  <el-pagination
                    v-model:current-page="tab.currentPage"
                    :page-size="tab.pageSize"
                    :total="tab.result.total"
                    :page-sizes="[20, 50, 100]"
                    layout="total, sizes, prev, pager, next"
                    @current-change="(p: number) => onPageChange(tab, p)"
                    @size-change="(s: number) => onSizeChange(tab, s)"
                  />
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
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
import { ref, computed, reactive, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElInput } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { listDatasources } from '@/api/datasource'
import { getSchemas, getObjects, getColumns } from '@/api/metadata'
import { executeStat, queryObject, getRedisValue } from '@/api/dataQuery'
import { listCommonStat, createCommonStat, type CommonStatItem } from '@/api/commonStat'
import type { DatasourceConfig } from '@/types/datasource'
import { encryptStat } from '@/utils/statEncrypt'

type QueryResult = { columns: string[]; rows: Record<string, unknown>[]; total: number }

interface SqlQueryTab {
  id: string
  title: string
  stat: string
  selectedCommonStatId: number | null
  result: QueryResult | null
  columnComments: string[]
  errorMsg: string
  currentPage: number
  pageSize: number
  lastExecutedStat: string
  lastQueryMode: 'stat' | 'object'
  lastObjectName: string
}

let tabIdSeq = 0
const genTabId = () => {
  tabIdSeq += 1
  return `sql-tab-${tabIdSeq}`
}

const createSqlTab = (title?: string): SqlQueryTab => ({
  id: genTabId(),
  title: title ?? '',
  stat: '',
  selectedCommonStatId: null,
  result: null,
  columnComments: [],
  errorMsg: '',
  currentPage: 1,
  pageSize: 20,
  lastExecutedStat: '',
  lastQueryMode: 'stat',
  lastObjectName: ''
})

const sqlTabs = ref<SqlQueryTab[]>([])
const activeTabId = ref('')
const loadingTabId = ref<string | null>(null)

/** 每个查询页面对应的 el-input 实例，用于读取选区 */
const statInputRefs = ref<Record<string, InstanceType<typeof ElInput> | null>>({})

const setStatInputRef = (tabId: string, el: InstanceType<typeof ElInput> | null) => {
  if (el) {
    statInputRefs.value[tabId] = el
  } else {
    delete statInputRefs.value[tabId]
  }
}

type StatTextareaSelection = { start: number; end: number }

const getStatTextarea = (tabId: string): HTMLTextAreaElement | null => {
  const input = statInputRefs.value[tabId]
  const root = input?.$el as HTMLElement | undefined
  const el = root?.querySelector?.('textarea')
  return el instanceof HTMLTextAreaElement ? el : null
}

/** 保存当前非空选区，用于异步查询结束后恢复高亮 */
const captureStatTextareaSelection = (tab: SqlQueryTab): StatTextareaSelection | null => {
  const textarea = getStatTextarea(tab.id)
  if (!textarea) return null
  const { selectionStart: start, selectionEnd: end } = textarea
  if (start === end) return null
  return { start, end }
}

const restoreStatTextareaSelection = (tab: SqlQueryTab, range: StatTextareaSelection | null) => {
  if (!range) return
  nextTick(() => {
    const textarea = getStatTextarea(tab.id)
    if (!textarea) return
    const len = tab.stat.length
    const start = Math.min(Math.max(0, range.start), len)
    const end = Math.min(Math.max(0, range.end), len)
    if (start === end) return
    textarea.focus()
    textarea.setSelectionRange(start, end)
  })
}

/**
 * 若文本框内有非空选区，只取选中文本；否则取全文（trim）。
 */
const resolveEffectiveStat = (tab: SqlQueryTab): string => {
  const raw = tab.stat
  const fullTrimmed = raw.trim()
  const textarea = getStatTextarea(tab.id)
  if (textarea) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    if (start !== end) {
      const selected = raw.slice(start, end).trim()
      if (selected.length > 0) {
        return selected
      }
    }
  }
  return fullTrimmed
}

const initSqlTabs = () => {
  const first = createSqlTab('查询 1')
  sqlTabs.value = [first]
  activeTabId.value = first.id
}

initSqlTabs()

const router = useRouter()
const route = useRoute()

const datasources = ref<DatasourceConfig[]>([])
const datasourceId = ref<number | null>(null)
const schemas = ref<string[]>([])
const currentSchema = ref<string>('')
const objects = ref<{ name: string }[]>([])
const objectName = ref<string>('')
/** Redis 查询仍用全局 loading */
const loading = ref(false)
const isRedis = computed(() => {
  const ds = datasources.value.find((d) => d.id === datasourceId.value)
  return ds?.type === 'REDIS'
})
const redisKey = ref('')
const redisResult = ref<unknown>(null)

const commonStatList = ref<CommonStatItem[]>([])
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

const resetSqlTabsForDatasourceChange = () => {
  initSqlTabs()
}

const addSqlTab = () => {
  const n = sqlTabs.value.length + 1
  const tab = createSqlTab(`查询 ${n}`)
  sqlTabs.value.push(tab)
  activeTabId.value = tab.id
}

const onTabRemove = (paneName: string | number) => {
  const name = String(paneName)
  if (sqlTabs.value.length <= 1) {
    ElMessage.warning('至少保留一个查询页')
    return
  }
  const idx = sqlTabs.value.findIndex((t) => t.id === name)
  if (idx === -1) return
  sqlTabs.value.splice(idx, 1)
  if (activeTabId.value === name) {
    const next = sqlTabs.value[idx] ?? sqlTabs.value[idx - 1]
    activeTabId.value = next?.id ?? sqlTabs.value[0]?.id ?? ''
  }
}

const onDatasourceChange = async () => {
  currentSchema.value = ''
  schemas.value = []
  objects.value = []
  objectName.value = ''
  resetSqlTabsForDatasourceChange()
  redisKey.value = ''
  redisResult.value = null
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
  tab: SqlQueryTab,
  dsId: number,
  schema: string,
  objectNameOrNull: string | null,
  columns: string[]
) => {
  const emptyComments = columns.map(() => '')
  if (!objectNameOrNull) {
    tab.columnComments = emptyComments
    return
  }
  try {
    const res = await getColumns(dsId, schema, objectNameOrNull)
    const list = (res.data as { columns?: { columnName?: string; columnComment?: string }[] })?.columns || []
    const commentMap = new Map(list.map((c) => [c.columnName ?? '', c.columnComment ?? '']))
    tab.columnComments = columns.map((col) => commentMap.get(col) ?? '')
  } catch {
    tab.columnComments = emptyComments
  }
}

const runQuery = async (tab: SqlQueryTab) => {
  if (!datasourceId.value) {
    ElMessage.warning('请先选择数据源')
    return
  }
  const savedSelection = captureStatTextareaSelection(tab)
  try {
    const statTrim = resolveEffectiveStat(tab)
    if (!statTrim) {
      if (objectName.value) {
        await runObjectQuery(tab)
        return
      }
      ElMessage.warning('请输入查询语句或选择表')
      return
    }
    if (!statTrim.toUpperCase().startsWith('SELECT')) {
      ElMessage.warning('仅支持 SELECT 查询')
      return
    }
    loadingTabId.value = tab.id
    tab.result = null
    tab.errorMsg = ''
    tab.currentPage = 1
    tab.lastExecutedStat = statTrim
    tab.lastQueryMode = 'stat'
    try {
      const encryptedStat = encryptStat(statTrim)
      const res = await executeStat(datasourceId.value, {
        schema: currentSchema.value || undefined,
        stat: encryptedStat ? undefined : statTrim,
        encryptedStat,
        page: 1,
        size: tab.pageSize
      })
      tab.result = res.data
      const parsed = parseObjectFromStat(statTrim)
      const schema = parsed?.schema?.trim() || currentSchema.value || ''
      const obj = parsed?.objectName ?? null
      await loadColumnComments(tab, datasourceId.value, schema, obj, res.data.columns)
    } catch (e: unknown) {
      const msg = getSafeErrorMessage(e, '查询失败，请稍后重试')
      tab.errorMsg = msg
      ElMessage.error(msg)
    } finally {
      loadingTabId.value = null
    }
  } finally {
    restoreStatTextareaSelection(tab, savedSelection)
  }
}

const runObjectQuery = async (tab: SqlQueryTab) => {
  const safeName = getValidatedObjectName(objectName.value)
  if (!datasourceId.value || !safeName) {
    ElMessage.warning('请先选择数据源和表')
    return
  }
  const savedSelection = captureStatTextareaSelection(tab)
  loadingTabId.value = tab.id
  tab.result = null
  tab.errorMsg = ''
  tab.currentPage = 1
  tab.lastQueryMode = 'object'
  tab.lastObjectName = safeName
  try {
    const res = await queryObject(datasourceId.value, {
      objectName: safeName,
      schema: currentSchema.value || undefined,
      page: 1,
      size: tab.pageSize
    })
    tab.result = res.data
    await loadColumnComments(tab, datasourceId.value, currentSchema.value || '', safeName, res.data.columns)
  } catch (e: unknown) {
    const msg = getSafeErrorMessage(e, '查询失败，请稍后重试')
    tab.errorMsg = msg
    ElMessage.error(msg)
  } finally {
    loadingTabId.value = null
    restoreStatTextareaSelection(tab, savedSelection)
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

const onSelectCommonStat = (tab: SqlQueryTab, id: number | null | undefined) => {
  if (id == null) return
  const item = commonStatList.value.find((it) => it.id === id)
  if (item) {
    tab.stat = item.statText
  }
}

const saveDialogSourceTab = ref<SqlQueryTab | null>(null)

const openSaveDialog = (tab: SqlQueryTab) => {
  const statTrim = tab.stat.trim()
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
  saveDialogSourceTab.value = tab
  saveDialogVisible.value = true
}

const submitSaveCommonStat = async () => {
  const tab = saveDialogSourceTab.value
  const statTrim = tab?.stat.trim() ?? ''
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
    saveDialogSourceTab.value = null
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

const fetchPage = async (tab: SqlQueryTab, page: number, size: number) => {
  if (!datasourceId.value) return
  if (tab.lastQueryMode === 'object') {
    if (!tab.lastObjectName) return
    loadingTabId.value = tab.id
    tab.errorMsg = ''
    try {
      const res = await queryObject(datasourceId.value, {
        objectName: tab.lastObjectName,
        schema: currentSchema.value || undefined,
        page,
        size
      })
      tab.result = res.data
      await loadColumnComments(tab, datasourceId.value, currentSchema.value || '', tab.lastObjectName, res.data.columns)
    } catch (e: unknown) {
      const msg = getSafeErrorMessage(e, '查询失败，请稍后重试')
      tab.errorMsg = msg
      ElMessage.error(msg)
    } finally {
      loadingTabId.value = null
    }
    return
  }
  if (!tab.lastExecutedStat) return
  loadingTabId.value = tab.id
  tab.errorMsg = ''
  try {
    const enc = encryptStat(tab.lastExecutedStat)
    const res = await executeStat(datasourceId.value, {
      schema: currentSchema.value || undefined,
      stat: enc ? undefined : tab.lastExecutedStat,
      encryptedStat: enc,
      page,
      size
    })
    tab.result = res.data
    const parsed = parseObjectFromStat(tab.lastExecutedStat)
    const schema = parsed?.schema?.trim() || currentSchema.value || ''
    const obj = parsed?.objectName ?? null
    await loadColumnComments(tab, datasourceId.value, schema, obj, res.data.columns)
  } catch (e: unknown) {
    const msg = getSafeErrorMessage(e, '查询失败，请稍后重试')
    tab.errorMsg = msg
    ElMessage.error(msg)
  } finally {
    loadingTabId.value = null
  }
}

const onPageChange = (tab: SqlQueryTab, page: number) => {
  fetchPage(tab, page, tab.pageSize)
}

const onSizeChange = (tab: SqlQueryTab, size: number) => {
  tab.pageSize = size
  tab.currentPage = 1
  fetchPage(tab, 1, size)
}

const getHeaderTooltipContent = (tab: SqlQueryTab, colIdx: number, col: string): string => {
  const comment = tab.columnComments[colIdx] ?? ''
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
  const firstTab = sqlTabs.value[0]
  if (firstTab) await runObjectQuery(firstTab)
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
/* 覆盖默认 20×20 的「+」槽位，改为完整主色按钮 */
.query-tabs :deep(.el-tabs__new-tab) {
  width: auto;
  height: auto;
  min-height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  margin: 4px 0 4px 12px;
  box-shadow: none;
  line-height: normal;
}
.query-tabs :deep(.el-tabs__new-tab:hover) {
  color: inherit;
}
.add-query-tab-btn {
  padding: 8px 16px;
  font-weight: 500;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--el-color-primary) 40%, transparent);
}
.add-query-tab-btn:hover {
  box-shadow: 0 3px 12px color-mix(in srgb, var(--el-color-primary) 50%, transparent);
}
.add-query-tab-icon {
  margin-right: 4px;
  font-size: 16px;
  vertical-align: middle;
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
