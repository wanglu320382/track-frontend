## 问题溯源系统 - 前端（track-frontend）

`track-frontend` 是 **问题溯源系统** 的前端应用，基于 **Vue 3 + TypeScript + Vite + Element Plus** 实现，主要用于：

- 展示和维护多种数据源配置（MySQL、Oracle、OceanBase、Redis 等）
- 提供统一的 SQL 执行与结果展示界面
- 提供库 / 表 / 字段等元数据可视化查询能力
- 提供系统登录、用户管理与权限控制（与后端 `track-backend` 配合）

后端项目为 `track-backend`，数据库设计见仓库根目录 `doc/db设计.md`，前端打包与发布流程见 `doc/前端升级步骤.md`。

---

## 目录结构概览

仅列出关键目录和文件，完整结构请参见代码仓库：

- `src/main.ts`：应用入口，注册 `Pinia`、`Vue Router` 与 `Element Plus`
- `src/App.vue`：根组件
- `src/router/index.ts`：路由配置与登录/管理员权限守卫
- `src/views/Layout.vue`：整体布局与菜单
- `src/views/Login.vue`：登录页面
- `src/views/DatasourceList.vue`：数据源管理页面
- `src/views/MetadataView.vue`：库 / 表 / 字段元数据展示
- `src/views/DataQuery.vue`：通用数据查询页面
- `src/views/CommonSqlManage.vue`：常用 SQL 模板管理
- `src/views/UserManage.vue`：系统用户管理（仅管理员可访问）
- `src/api/*.ts`：与后端的接口封装（数据源、元数据、查询、用户、鉴权等）
- `src/utils/sqlEncrypt.ts`：SQL 加密相关工具
- `vite.config.ts`：Vite 配置（包括开发环境代理等）
- `package.json`：前端依赖与脚本

---

## 技术栈

- **语言**：TypeScript
- **框架**：
  - Vue 3（Composition API）
  - Vue Router 4
  - Pinia 2
- **UI 组件库**：Element Plus
- **HTTP 客户端**：Axios
- **构建工具**：Vite 5 + vue-tsc

---

## 环境要求

- Node.js 18+
- npm（或兼容的包管理工具，如 pnpm / yarn，需自行调整命令）
- 已部署并可访问的后端服务 `track-backend`（开发环境通常为 `http://localhost:8080`）

---

## 本地开发

### 1. 克隆代码

```bash
git clone <your-github-repo-url>.git
cd track-frontend
```

> 若后端与前端同仓库，请根据实际路径进入 `track-frontend` 目录。

### 2. 安装依赖

```bash
npm install
```

### 3. 配置开发环境

- 默认的开发环境配置位于 `.env.development` 与 `vite.config.ts` 中。
- 如需修改后端接口地址，可：
  - 在 `.env.development` 中配置自定义变量（例如 `VITE_API_BASE_URL`），并在 `src/api/request.ts` 中使用；
  - 或在 `vite.config.ts` 中调整 `server.proxy` 目标地址，将 `/api` 等前缀代理到后端（如 `http://localhost:8080`）。

### 4. 启动开发服务

```bash
npm run dev
```

启动后在浏览器访问提示的地址（一般为 `http://localhost:5173`），即可进行本地开发与调试。

---

## 构建与发布

> 详细步骤可参考仓库根目录 `doc/前端升级步骤.md`。

### 1. 生产打包

```bash
cd track-frontend
npm run build
```

- 会先执行 `vue-tsc` 做 TypeScript 类型检查，再执行 `vite build` 生成生产包。
- 打包成功后，静态资源会输出到项目根目录下的 `dist` 目录。

### 2. 本地预览

```bash
npm run preview
```

在浏览器访问提示的地址（一般为 `http://localhost:4173`），确认页面展示和接口访问是否正常。

### 3. 发布到服务器

1. 将整个 `dist` 目录上传到生产服务器（可通过 FTP、SCP、rsync 或 CI/CD 流水线）。
2. 在 Web 服务器（Nginx / Apache 等）中：
   - 将站点根目录指向 `dist` 目录；
   - 如前端通过 `/api` 等前缀访问后端，需配置反向代理到实际后端地址（如 `http://your-backend-host:8080`）。
3. 若生产环境与开发环境的后端地址不同，打包前请先调整前端的 API 基础地址（环境变量或 `src/api/request.ts` 配置），再执行 `npm run build`。

---

## 登录与权限说明（前端视角）

- 前端通过登录接口获取 Token，并将其保存在浏览器 `localStorage` 中（键名示例：`auth_token` 与 `auth_user`）。
- 路由在进入前会检查：
  - 若无 Token，则强制跳转到 `/login`；
  - 若访问的路由标记了 `meta.requiresAdmin = true`（如 `用户管理`），则会检查当前用户是否为管理员角色，不满足时会跳转到数据源列表页。
- 角色与用户信息由后端 `track-backend` 负责管理，前端只做展示与基本控制。

---

## 与后端协同

- 推荐在前端开发阶段，将接口代理到本地后端服务：
  - 前端：`http://localhost:5173`
  - 后端：`http://localhost:8080`
- 生产环境中，可通过 Nginx 等方式将前端静态资源与后端 API 暴露在同一域名下：
  - 例如：`https://your-domain.com` 为前端，`https://your-domain.com/api` 反向代理至 `track-backend`。

---

## 许可证

请根据你计划开源的协议在仓库根目录添加 `LICENSE` 文件，并在此处补充说明（例如 MIT / Apache-2.0 等）。

