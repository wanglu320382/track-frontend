<template>
  <div class="metadata-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>表结构与注释</span>
          <el-select v-model="datasourceId" placeholder="选择数据源" filterable style="width: 220px" @change="onDatasourceChange">
            <el-option v-for="ds in datasources" :key="ds.id" :label="`${ds.name} (${ds.type})`" :value="ds.id" />
          </el-select>
        </div>
      </template>
      <div class="metadata-content" v-loading="loading">
        <div class="tree-panel" v-if="datasourceId">
          <div class="schema-select" v-if="schemas.length">
            <el-select v-model="currentSchema" placeholder="选择库/Schema" filterable style="width: 100%" @change="loadTables">
              <el-option v-for="s in schemas" :key="s" :label="s" :value="s" />
            </el-select>
          </div>
          <div class="table-list-header">
            <span>表列表</span>
            <el-input
              v-if="!isRedis"
              v-model="tableFilter"
              placeholder="按表名或注释模糊搜索"
              clearable
              size="small"
              style="width: 100%; margin-top: 4px"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </div>
          <div class="table-list">
            <div v-for="t in filteredTables" :key="t.name" class="table-item" :class="{ active: selectedTable === t.name }" @click="selectTable(t)">
              <span class="table-name">{{ t.name }}</span>
              <span v-if="t.comment" class="comment">{{ t.comment }}</span>
            </div>
          </div>
        </div>
        <div class="detail-panel">
          <!-- 表结构：字段名、类型、注释 -->
          <template v-if="columns.length">
            <div class="detail-header">
              <span class="table-title">{{ selectedTable }} 表结构</span>
              <el-button type="primary" size="small" @click="goViewTableData">查看数据</el-button>
            </div>
            <el-table :data="columns" stripe border>
              <el-table-column prop="columnName" label="字段名" width="160" />
              <el-table-column prop="columnType" label="类型" width="140" />
              <el-table-column prop="columnComment" label="注释" min-width="160" />
              <el-table-column prop="nullable" label="可空" width="70" />
              <el-table-column prop="primaryKey" label="主键" width="70">
                <template #default="{ row }">{{ row.primaryKey ? '是' : '' }}</template>
              </el-table-column>
            </el-table>
          </template>
          <!-- Redis Keys 列表 -->
          <template v-else-if="selectedTable === 'keys'">
            <div class="detail-header redis-header">
              <span class="table-title">Redis Key 列表</span>
              <div class="redis-toolbar">
                <el-input v-model="redisKeyPattern" placeholder="支持模糊，如 config:api:rate_lim 可匹配 rate_limit" clearable style="width: 220px" @keyup.enter="loadRedisKeys" />
                <el-button type="primary" @click="loadRedisKeys" :loading="loadingRedisKeys">刷新</el-button>
              </div>
            </div>
            <el-table v-if="redisKeys.length" :data="redisKeys" stripe border max-height="380">
              <el-table-column prop="key" label="Key" min-width="220" show-overflow-tooltip />
              <el-table-column label="操作" width="90" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="viewRedisKey(row.key)">查看</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无 Key 或请点击刷新" :image-size="80" />
          </template>
          <el-empty v-else description="请在左侧选择表查看结构，Redis 数据源选择 keys 查看 Key 列表" :image-size="100" />
        </div>
      </div>
    </el-card>

    <!-- Redis Key 详情弹窗 -->
    <el-dialog v-model="redisKeyDialogVisible" :title="`Key: ${redisKeyViewing}`" width="560px">
      <el-descriptions v-if="redisKeyDetail" :column="1" border>
        <el-descriptions-item label="类型">{{ redisKeyDetail.type }}</el-descriptions-item>
        <el-descriptions-item label="值">
          <pre class="redis-value-pre">{{ formatRedisValue(redisKeyDetail.value) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { listDatasources } from '@/api/datasource'
import { getSchemas, getTables, getColumns, getRedisKeys, getRedisKeyInfo } from '@/api/metadata'
import type { DatasourceConfig } from '@/types/datasource'

const datasources = ref<DatasourceConfig[]>([])
const datasourceId = ref<number | null>(null)
const schemas = ref<string[]>([])
const currentSchema = ref<string>('')
const tables = ref<{ name: string; comment: string }[]>([])
const selectedTable = ref<string>('')
const columns = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const tableFilter = ref('')
const redisKeys = ref<{ key: string }[]>([])
const redisKeyPattern = ref('*')
const loadingRedisKeys = ref(false)
const redisKeyDialogVisible = ref(false)
const redisKeyViewing = ref('')
const redisKeyDetail = ref<{ type: string; value: unknown } | null>(null)

const isRedis = computed(() => {
  const ds = datasources.value.find((d) => d.id === datasourceId.value)
  return ds?.type === 'REDIS'
})

const filteredTables = computed(() => {
  const kw = tableFilter.value?.trim().toLowerCase()
  if (!kw) return tables.value
  return tables.value.filter(
    (t) =>
      t.name.toLowerCase().includes(kw) ||
      (t.comment && String(t.comment).toLowerCase().includes(kw))
  )
})

const loadDatasources = async () => {
  const res = await listDatasources()
  datasources.value = res.data || []
  if (datasources.value.length && !datasourceId.value) {
    datasourceId.value = datasources.value[0].id!
  }
}

const onDatasourceChange = () => {
  currentSchema.value = ''
  schemas.value = []
  tables.value = []
  selectedTable.value = ''
  columns.value = []
  redisKeys.value = []
  redisKeyPattern.value = '*'
  if (datasourceId.value) loadSchemas()
}

const loadSchemas = async () => {
  if (!datasourceId.value) return
  loading.value = true
  try {
    const res = await getSchemas(datasourceId.value)
    schemas.value = res.data || []
    if (schemas.value.length) {
      currentSchema.value = schemas.value[0]
      await loadTables()
    } else {
      tables.value = [{ name: 'keys', comment: 'Redis Keys' }]
    }
  } catch (e: unknown) {
    ElMessage.error((e as Error)?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const loadTables = async () => {
  if (!datasourceId.value) return
  loading.value = true
  try {
    const res = await getTables(datasourceId.value, currentSchema.value)
    tables.value = (res.data || []).map((t: { name?: string; comment?: string }) => ({
      name: t.name || '',
      comment: t.comment || ''
    }))
    selectedTable.value = ''
    columns.value = []
  } catch (e: unknown) {
    ElMessage.error((e as Error)?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const selectTable = async (t: { name: string }) => {
  selectedTable.value = t.name
  columns.value = []
  if (t.name === 'keys') {
    await loadRedisKeys()
    return
  }
  loading.value = true
  try {
    const res = await getColumns(datasourceId.value!, currentSchema.value, t.name)
    const info = res.data as { columns?: Record<string, unknown>[] }
    columns.value = info?.columns || []
  } catch (e: unknown) {
    ElMessage.error((e as Error)?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const loadRedisKeys = async () => {
  if (!datasourceId.value) return
  loadingRedisKeys.value = true
  try {
    // Redis 模糊查询：若用户输入不含 * 或 ?，自动追加 * 做前缀匹配（如 config:api:rate_lim 可匹配 config:api:rate_limit）
    let pattern = redisKeyPattern.value?.trim() || '*'
    if (pattern !== '*' && !pattern.includes('*') && !pattern.includes('?')) {
      pattern = pattern + '*'
    }
    const res = await getRedisKeys(datasourceId.value, pattern)
    const keys = res.data || []
    redisKeys.value = keys.map((k) => ({ key: k }))
  } catch (e: unknown) {
    ElMessage.error((e as Error)?.message || '加载 Redis Keys 失败')
  } finally {
    loadingRedisKeys.value = false
  }
}

const viewRedisKey = async (key: string) => {
  if (!datasourceId.value) return
  redisKeyViewing.value = key
  redisKeyDetail.value = null
  redisKeyDialogVisible.value = true
  try {
    const res = await getRedisKeyInfo(datasourceId.value, key)
    redisKeyDetail.value = res.data || { type: 'unknown', value: null }
  } catch (e: unknown) {
    ElMessage.error((e as Error)?.message || '获取 Key 详情失败')
  }
}

const formatRedisValue = (val: unknown): string => {
  if (val == null) return '(空)'
  if (typeof val === 'object') return JSON.stringify(val, null, 2)
  return String(val)
}

const router = useRouter()
/** 跳转到数据查询画面，并带上当前数据源、库、表，自动展示表数据 */
const goViewTableData = () => {
  if (!datasourceId.value || !selectedTable.value) {
    ElMessage.warning('请先选择数据源和表')
    return
  }
  const route = router.resolve({
    path: '/query',
    query: {
      datasourceId: String(datasourceId.value),
      schema: currentSchema.value || '',
      table: selectedTable.value
    }
  })
  window.open(route.href, '_blank')
}

watch(datasourceId, () => onDatasourceChange())

loadDatasources()
</script>

<style scoped>
.metadata-view :deep(.el-card__body) {
  padding-left: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.metadata-content {
  display: flex;
  gap: 20px;
  min-height: 420px;
}
.tree-panel {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--el-border-color-light);
  padding-right: 16px;
  padding-left: 0;
}
.schema-select {
  margin-bottom: 12px;
}
.table-list-header {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  padding-left: 0;
  margin-left: 0;
}
.table-list-header :deep(.el-input) {
  margin-left: 0;
}
.table-list {
  max-height: 340px;
  overflow-y: auto;
}
.table-item {
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 4px;
  line-height: 1.4;
}
.table-item:hover,
.table-item.active {
  background: var(--el-fill-color-light);
}
.table-item .table-name {
  font-weight: 500;
}
.table-item .comment {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 2px;
}
.detail-panel {
  flex: 1;
  min-width: 0;
}
.detail-header {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.detail-header.redis-header {
  flex-wrap: wrap;
  gap: 12px;
}
.table-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}
.redis-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}
.redis-value-pre {
  margin: 0;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 13px;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
