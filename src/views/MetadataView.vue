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
            <el-select v-model="currentSchema" placeholder="选择库/Schema" filterable style="width: 100%" @change="loadObjects">
              <el-option v-for="s in schemas" :key="s" :label="s" :value="s" />
            </el-select>
          </div>
          <div class="object-list-header">
            <span>表列表</span>
            <el-input
              v-if="!isRedis"
              v-model="objectFilter"
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
          <div class="object-list">
            <div v-for="t in filteredObjects" :key="t.name" class="object-item" :class="{ active: selectedObject === t.name }" @click="selectObject(t)">
              <span class="object-name">{{ t.name }}</span>
              <span v-if="t.comment" class="comment">{{ t.comment }}</span>
            </div>
          </div>
        </div>
        <div class="detail-panel">
          <template v-if="columns.length">
            <div class="detail-header">
              <span class="object-title">{{ selectedObject }} 表结构</span>
              <el-button-group class="detail-actions">
                <el-button type="primary" size="small" @click="goViewData">查看数据</el-button>
                <el-button type="primary" size="small" plain @click="openFieldExtractDialog">字段提取</el-button>
              </el-button-group>
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
          <template v-else-if="selectedObject === 'keys'">
            <div class="detail-header redis-header">
              <span class="object-title">Redis Key 列表</span>
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

    <el-dialog v-model="redisKeyDialogVisible" :title="`Key: ${redisKeyViewing}`" width="560px">
      <el-descriptions v-if="redisKeyDetail" :column="1" border>
        <el-descriptions-item label="类型">{{ redisKeyDetail.type }}</el-descriptions-item>
        <el-descriptions-item label="值">
          <pre class="redis-value-pre">{{ formatRedisValue(redisKeyDetail.value) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="fieldExtractDialogVisible" :title="`字段提取: ${selectedObject}`" width="520px">
      <template #default>
        <el-empty v-if="!fieldExtractText" description="暂无字段可提取" :image-size="80" />
        <div v-else>
          <div class="field-extract-toolbar">
            <el-button size="small" type="primary" @click="copyFieldExtract">复制</el-button>
          </div>
          <pre class="field-extract-pre">{{ fieldExtractText }}</pre>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { listDatasources } from '@/api/datasource'
import { getSchemas, getObjects, getColumns, getRedisKeys, getRedisKeyInfo } from '@/api/metadata'
import type { DatasourceConfig } from '@/types/datasource'

const datasources = ref<DatasourceConfig[]>([])
const datasourceId = ref<number | null>(null)
const schemas = ref<string[]>([])
const currentSchema = ref<string>('')
const objects = ref<{ name: string; comment: string }[]>([])
const selectedObject = ref<string>('')
const columns = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const objectFilter = ref('')
const redisKeys = ref<{ key: string }[]>([])
const redisKeyPattern = ref('*')
const loadingRedisKeys = ref(false)
const redisKeyDialogVisible = ref(false)
const redisKeyViewing = ref('')
const redisKeyDetail = ref<{ type: string; value: unknown } | null>(null)
const fieldExtractDialogVisible = ref(false)
const fieldExtractText = ref('')

const isRedis = computed(() => {
  const ds = datasources.value.find((d) => d.id === datasourceId.value)
  return ds?.type === 'REDIS'
})

const filteredObjects = computed(() => {
  const kw = objectFilter.value?.trim().toLowerCase()
  if (!kw) return objects.value
  return objects.value.filter(
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
  objects.value = []
  selectedObject.value = ''
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
      await loadObjects()
    } else {
      objects.value = [{ name: 'keys', comment: 'Redis Keys' }]
    }
  } catch (e: unknown) {
    ElMessage.error((e as Error)?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const loadObjects = async () => {
  if (!datasourceId.value) return
  loading.value = true
  try {
    const res = await getObjects(datasourceId.value, currentSchema.value)
    objects.value = (res.data || []).map((t: { name?: string; comment?: string }) => ({
      name: t.name || '',
      comment: t.comment || ''
    }))
    selectedObject.value = ''
    columns.value = []
  } catch (e: unknown) {
    ElMessage.error((e as Error)?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const selectObject = async (t: { name: string }) => {
  selectedObject.value = t.name
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
const goViewData = () => {
  if (!datasourceId.value || !selectedObject.value) {
    ElMessage.warning('请先选择数据源和表')
    return
  }
  const route = router.resolve({
    path: '/query',
    query: {
      datasourceId: String(datasourceId.value),
      schema: currentSchema.value || '',
      object: selectedObject.value
    }
  })
  window.open(route.href, '_blank')
}

const openFieldExtractDialog = () => {
  if (!columns.value?.length) {
    ElMessage.warning('暂无字段可提取')
    return
  }

  // 按 `表名.json` 中 column 数组的展示方式输出：每行 `"字段名",`
  const escapeForJsonString = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')

  const fieldNames = (columns.value || [])
    .map((c) => (c as Record<string, unknown>).columnName)
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)

  fieldExtractText.value = fieldNames.map((n) => `"${escapeForJsonString(n)}",`).join('\n')
  fieldExtractDialogVisible.value = true
}

const copyFieldExtract = async () => {
  try {
    if (!fieldExtractText.value) return
    await navigator.clipboard.writeText(fieldExtractText.value)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选择复制')
  }
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
.object-list-header {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  padding-left: 0;
  margin-left: 0;
}
.object-list-header :deep(.el-input) {
  margin-left: 0;
}
.object-list {
  max-height: 340px;
  overflow-y: auto;
}
.object-item {
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 4px;
  line-height: 1.4;
}
.object-item:hover,
.object-item.active {
  background: var(--el-fill-color-light);
}
.object-item .object-name {
  font-weight: 500;
}
.object-item .comment {
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
  gap: 12px;
}
.detail-header .detail-actions {
  flex-shrink: 0;
}
.detail-header.redis-header {
  flex-wrap: wrap;
  gap: 12px;
}
.object-title {
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

.field-extract-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.field-extract-pre {
  margin: 0;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 13px;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
