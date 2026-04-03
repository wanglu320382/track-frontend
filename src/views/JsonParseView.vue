<template>
  <div class="json-parse-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>json解析</span>
          <div class="header-actions">
            <el-button type="primary" :loading="parsing" @click="parseJson">解析</el-button>
            <el-button @click="clearAll">清空</el-button>
          </div>
        </div>
      </template>

      <div class="content">
        <div class="left-panel">
          <el-input
            v-model="jsonText"
            type="textarea"
            :rows="22"
            resize="vertical"
            placeholder="请粘贴 xdata 的 column.json / querySql.json 配置内容"
            class="json-input"
            @keydown.ctrl.enter="parseJson"
          />
          <div class="hint">
            支持从 `reader.parameter.column`/`writer.parameter.column` 自动提取字段；若仅有 `querySql` 则从 `SELECT ... FROM ...` 解析源字段。
          </div>
        </div>

        <div class="right-panel">
          <div class="mapping-title">
            <span class="mapping-source">{{ sourceTable }}</span>
            <span class="mapping-dash">--</span>
            <span class="mapping-target">{{ targetTable }}</span>
          </div>

          <div class="results">
            <el-empty
              v-if="rows.length === 0"
              description="暂无解析结果，点击“解析”后显示字段映射"
              :image-size="90"
            />

            <el-table
              v-else
              :data="rows"
              stripe
              border
              style="width: 100%"
              height="100%"
            >
              <el-table-column prop="id" label="序号" width="80" />
              <el-table-column prop="sourceField" label="源表字段" min-width="200" show-overflow-tooltip />
              <el-table-column prop="targetField" label="目标表字段" min-width="200" show-overflow-tooltip />
            </el-table>
          </div>

          <div v-if="parseHint" class="parse-hint">
            <el-alert :title="parseHint" type="info" show-icon :closable="false" />
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

interface MappingRow {
  id: number
  sourceField: string
  targetField: string
}

const jsonText = ref('')
const parsing = ref(false)
const sourceTable = ref('-')
const targetTable = ref('-')
const rows = ref<MappingRow[]>([])
const parseHint = ref('')

const stripIdentifier = (s: string): string => {
  const trimmed = s.trim()
  if (!trimmed) return ''
  // 去掉常见引号/中括号包裹：`a` / "a" / 'a' / [a]
  let out = trimmed
  while (out.length > 0) {
    const first = out[0]!
    if (first === '`' || first === '"' || first === "'" || first === '[') {
      out = out.slice(1).trim()
      continue
    }
    break
  }
  while (out.length > 0) {
    const last = out[out.length - 1]!
    if (last === '`' || last === '"' || last === "'" || last === ']') {
      out = out.slice(0, -1).trim()
      continue
    }
    break
  }
  return out
}

const toStringArray = (v: unknown): string[] => {
  if (Array.isArray(v)) {
    return v
      .filter((x) => typeof x === 'string')
      .map((s) => stripIdentifier(s))
      .filter((s) => s.length > 0)
  }
  if (typeof v === 'string') {
    const s = stripIdentifier(v)
    return s ? [s] : []
  }
  return []
}

const splitSqlSelectList = (selectPart: string): string[] => {
  const out: string[] = []
  let buf = ''
  let depth = 0
  for (let i = 0; i < selectPart.length; i += 1) {
    const ch = selectPart[i]!
    if (ch === '(') depth += 1
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      out.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

const deriveFieldNameFromSelectToken = (tokenRaw: string): string => {
  const token = tokenRaw.trim()
  if (!token) return ''

  // 优先匹配显式别名：... AS alias
  const asMatch = token.match(/\s+AS\s+([A-Za-z_][A-Za-z0-9_$]*)\s*$/i)
  if (asMatch?.[1]) return stripIdentifier(asMatch[1])

  // 其次匹配隐式别名：... alias
  const parts = token.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!
    if (/^[A-Za-z_][A-Za-z0-9_$]*$/.test(last)) return stripIdentifier(last)
  }

  // 无别名时，尝试取末段列名：t.col -> col
  const cleaned = stripIdentifier(token).replace(/`/g, '')
  if (cleaned.includes('.')) return cleaned.split('.').pop() ?? cleaned
  return cleaned
}

const parseSelectColumnsFromQuerySql = (sql: string): string[] => {
  const oneLine = sql.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  const selectMatch = oneLine.match(/\bselect\s+(.*?)\s+\bfrom\s+/i)
  if (!selectMatch?.[1]) return []
  let selectPart = selectMatch[1]!.trim()

  selectPart = selectPart.replace(/^\s*distinct\s+/i, '')
  const tokens = splitSqlSelectList(selectPart)
  return tokens.map(deriveFieldNameFromSelectToken).filter((s) => s.length > 0)
}

const parseFromTableFromQuerySql = (sql: string): string => {
  const oneLine = sql.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  const fromMatch = oneLine.match(/\bfrom\s+([^\s]+)\b/i)
  if (!fromMatch?.[1]) return ''
  return stripIdentifier(fromMatch[1]!)
}

const getFirstString = (v: unknown): string => {
  if (typeof v === 'string') return stripIdentifier(v)
  if (Array.isArray(v)) {
    const first = v.find((x) => typeof x === 'string')
    return first ? stripIdentifier(first) : ''
  }
  return ''
}

const parseJson = () => {
  const raw = jsonText.value
  const trimmed = raw?.trim()
  if (!trimmed) {
    ElMessage.warning('请先粘贴 JSON 内容')
    return
  }

  parsing.value = true
  parseHint.value = ''
  try {
    const parsed = JSON.parse(trimmed) as any
    const content0 = parsed?.job?.content?.[0]
    if (!content0) {
      ElMessage.warning('未找到 job.content[0]，请确认这是 xdata 的配置 JSON')
      rows.value = []
      sourceTable.value = '-'
      targetTable.value = '-'
      return
    }

    const readerParam = content0?.reader?.parameter
    const writerParam = content0?.writer?.parameter
    const readerConn0 = readerParam?.connection?.[0]
    const writerConn0 = writerParam?.connection?.[0]

    const fromTableCandidate = getFirstString(readerConn0?.table)
    const toTableCandidate = getFirstString(writerConn0?.table)
    const querySqlCandidate = getFirstString(readerConn0?.querySql)

    sourceTable.value = fromTableCandidate || (querySqlCandidate ? parseFromTableFromQuerySql(querySqlCandidate) : '') || '-'
    targetTable.value = toTableCandidate || '-'

    let sourceFields = toStringArray(readerParam?.column)
    const targetFields = toStringArray(writerParam?.column)

    if (sourceFields.length === 0 && querySqlCandidate) {
      sourceFields = parseSelectColumnsFromQuerySql(querySqlCandidate)
      if (!sourceTable.value || sourceTable.value === '-') {
        sourceTable.value = parseFromTableFromQuerySql(querySqlCandidate) || '-'
      }
    }

    if (sourceFields.length === 0 && targetFields.length === 0) {
      ElMessage.warning('未找到可映射的字段：请确认 reader/writer 的 column 或 querySql 配置是否存在')
    }

    const maxLen = Math.max(sourceFields.length, targetFields.length)
    const nextRows: MappingRow[] = []
    for (let i = 0; i < maxLen; i += 1) {
      nextRows.push({
        id: i + 1,
        sourceField: sourceFields[i] || '-',
        targetField: targetFields[i] || '-',
      })
    }
    rows.value = nextRows

    if (sourceFields.length !== targetFields.length) {
      parseHint.value = `源字段数量(${sourceFields.length}) 与 目标字段数量(${targetFields.length}) 不一致，将按序号对齐展示。`
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '解析失败'
    // 前端仅展示通用错误信息，不回显原始错误细节（避免干扰用户）
    ElMessage.error(msg.includes('Unexpected token') ? 'JSON 格式不正确，请检查引号/逗号' : '解析失败，请检查 JSON 内容')
    rows.value = []
    sourceTable.value = '-'
    targetTable.value = '-'
  } finally {
    parsing.value = false
  }
}

const clearAll = () => {
  jsonText.value = ''
  parsing.value = false
  sourceTable.value = '-'
  targetTable.value = '-'
  rows.value = []
  parseHint.value = ''
}
</script>

<style scoped>
.json-parse-view {
  padding: 4px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

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

.content {
  display: flex;
  gap: 18px;
  flex: 1;
  min-height: 0;
}

.json-parse-view :deep(.el-card) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.json-parse-view :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.left-panel {
  flex: 0 0 48%;
  min-width: 420px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.json-input {
  flex: 1;
  min-height: 0;
}

.json-input :deep(textarea) {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}
.json-input :deep(.el-textarea__inner) {
  height: 100% !important;
}
.json-input :deep(.el-textarea__wrapper) {
  height: 100% !important;
  min-height: 0;
}

.hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.right-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.results {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.mapping-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}

.mapping-source,
.mapping-target {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mapping-dash {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.parse-hint {
  margin-top: 12px;
}
</style>

