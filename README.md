# Qing's R2 Admin

一个部署在 **Cloudflare Pages** 上的 **Cloudflare R2 管理面板**：不需要自建服务器，使用 Pages Functions + R2 绑定实现桶内文件的查看、上传、预览、下载与批量操作。

> 推荐用法：每个人 fork 本仓库 → 部署到自己的 Cloudflare Pages → 绑定自己的 R2 桶，即可管理自己的文件。

---

## 功能

- 多桶切换（Pages 绑定多个 R2 存储桶）
- 文件与文件夹浏览（支持“空文件夹”）
- 大文件分片上传（multipart），支持**暂停 / 继续续传 / 取消**
- 预览：图片 / 音频 / 视频（Range）/ PDF / Office 在线预览
- 文件操作：下载 / 重命名 / 移动
- 批量：下载、移动（按勾选）
- 全局搜索（当前桶内扫描匹配）
- 可选访问密码：设置 `ADMIN_PASSWORD` 后启用登录页与 API 鉴权

---

## 部署到 Cloudflare Pages（推荐）

### 1) Fork 仓库并创建 Pages 项目

在 Cloudflare Dashboard：
1. Pages → 创建项目 → 连接 GitHub 仓库
2. 选择本仓库（或你的 fork）

### 2) 构建配置

- 构建命令：`npx @cloudflare/next-on-pages@1`
- 构建输出目录：`.vercel/output/static`

### 3) Functions 兼容性标志

Pages → 设置 → 函数 → 兼容性标志：
- 添加：`nodejs_compat`（建议生产/预览都加）

### 4) 绑定 R2 存储桶（核心）

Pages → 设置 → 函数 → 绑定 → 添加：
- 类型：R2 存储桶
- 绑定名称：建议英文且以 `R2_` 开头（例如 `R2_BLOG`、`R2_CLOUD`）
- 选择你的 R2 桶

绑定完成后重新部署一次，页面就会显示桶列表并可操作文件。

---

## 环境变量（可选）

### 启用「直连 R2」下载/预览（S3 预签名 / 推荐）

默认情况下，本项目会通过 Pages Functions + R2 Binding（/api/object）代理文件流。
如果你希望预览/下载更快、更稳定，并且浏览器能显示下载总大小，推荐启用 **S3 预签名直连**：
站点只负责签发临时 URL，文件字节由浏览器直接从 R2 拉取。

需要在 Pages → Settings → Environment variables 配置：

| 变量名 | 类型建议 | 说明 |
|---|---|---|
| `R2_ACCOUNT_ID` | Text | Cloudflare Account ID（R2 S3 endpoint 需要） |
| `R2_ACCESS_KEY_ID` | Secret/Text | R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Secret | R2 Secret Access Key |

并提供 **binding 名 → 真实 R2 bucket 名** 的映射（三种方式任选其一）：

- 简单模式：直接把 `R2_BUCKETS` 的 value 写成真实 bucket 名（例如 `R2_BLOG:my-blog,R2_CLOUD:qing-cloud`）。
  - 好处：不需要额外变量；UI 显示名就是 bucket 名。
- 自定义显示名：`R2_BUCKETS` 用于显示名/顺序（例如 `R2_BLOG:博客,R2_CLOUD:云盘`），同时新增 `R2_BUCKET_NAMES` 用于真实 bucket 名（例如 `R2_BLOG:my-blog,R2_CLOUD:qing-cloud`）。

- 无需新增环境变量：在页面左侧底部的「链接设置」里，为每个绑定填写一次 **S3 桶名**（真实 bucket 名）。

说明：配置齐全后，`/api/download` 会优先返回 presigned URL；未配置则自动回退到代理模式。

> 获取 Access Key：Cloudflare Dashboard → R2 → Manage R2 API Tokens / S3 API（创建 Access Key）。

其他可选环境变量（建议用“密钥”保存敏感值）：

### `ADMIN_PASSWORD`（密钥 / 推荐）

开启访问登录与接口鉴权。

- 未设置：打开站点直接进入（任何人都能操作你绑定的桶）
- 已设置：打开站点先出现“访问登录”页，输入密码后才能进入管理

### `ADMIN_USERNAME`（文本 / 可选）

开启“账号 + 密码”双校验。

- 未设置：仅校验 `ADMIN_PASSWORD`（页面“管理账号”输入框不参与鉴权）
- 已设置：同时校验账号与密码（账号必须等于 `ADMIN_USERNAME`）

### `R2_BUCKETS`（文本 / 可选）

用于自定义桶显示名与顺序（也可避免误识别）。

> 如果你启用了上面的 S3 预签名直连但没有配置 `R2_BUCKET_NAMES`，则需要通过以下任意方式提供真实 bucket 名：
> 1) 直接把 `R2_BUCKETS` 的 value 写成真实 bucket 名；或
> 2) 配置 `R2_BUCKET_NAMES`；或
> 3) 在页面「链接设置」里填写 S3 桶名。

支持两种格式：
- CSV：`R2_BLOG:博客,R2_CLOUD:云盘`
- JSON：`{"R2_BLOG":"博客","R2_CLOUD":"云盘"}`

### `R2_BUCKET_NAMES`（文本 / 可选）

用于提供 **binding 名 → 真实 R2 bucket 名** 的映射（主要给 S3 预签名直连使用），从而让你可以把 `R2_BUCKETS` 单纯用于“显示名/排序”。

格式支持 CSV 或 JSON，例如：
- CSV：`R2_BLOG:my-blog,R2_CLOUD:qing-cloud`
- JSON：`{"R2_BLOG":"my-blog","R2_CLOUD":"qing-cloud"}`

### `ADMIN_TOKEN_SECRET`（密钥 / 高级）

用于签发预览/下载/上传的短期 token（不想依赖 `ADMIN_PASSWORD` 时可单独设置）。

---

## 本地开发

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

> 本项目的核心能力来自 Cloudflare Pages 的 R2 绑定；本地开发时如果没有对应环境，部分功能需要在 Pages 环境验证。

---

## 安全说明（重要）

- 本项目基于 **Pages 绑定桶** 管理文件：谁部署、谁绑定、谁就拥有对绑定桶的读写权限。
- 强烈建议设置 `ADMIN_PASSWORD`（并使用“密钥”类型保存）。
- 勾选“在本地记住密码”会把密码存到浏览器 localStorage；公用电脑不要勾选，用完点击“退出登录”。

---

## 已知限制 / 说明

- “全局搜索”通过扫描 `list` 结果匹配，桶很大时可能较慢。
- 文件夹移动/复制在 R2 侧没有原生“目录”概念，内部实现为遍历 key 并逐个拷贝/删除。

---

# Qing's R2 Admin (English)

A Cloudflare Pages + R2 bindings based admin panel. No custom server required. Fork → deploy to your own Pages → bind your R2 buckets → manage your files.

## Quick Deploy (Cloudflare Pages)

- Build command: `npx @cloudflare/next-on-pages@1`
- Output directory: `.vercel/output/static`
- Compatibility flags: `nodejs_compat`
- Bindings: Pages → Settings → Functions → Bindings → R2 bucket (recommend binding names starting with `R2_`)

## Optional Env Vars

### Presigned Direct URLs (Recommended)

By default, this project proxies file bytes via Pages Functions + R2 Binding (`/api/object`).
For faster and more reliable preview/download (and to let browsers show the total size), enable **S3 presigned URLs**: the site only signs a temporary URL, and the browser downloads/streams directly from R2.

Set these env vars in Cloudflare Pages:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

And provide a **binding-name → real bucket-name** mapping (choose one):

- Simple: set `R2_BUCKETS` values to real bucket names (e.g. `R2_BLOG:my-blog,R2_CLOUD:qing-cloud`).
- Custom display names: keep `R2_BUCKETS` for display/order, and set `R2_BUCKET_NAMES` to real bucket names.

- No extra env vars: set the real **S3 bucket name** once per binding in the UI (bottom-left “链接设置”).

When configured, `/api/download` returns a presigned URL first; otherwise it falls back to the proxied `/api/object` URL.

- `ADMIN_PASSWORD` (secret): enable login + API auth
- `ADMIN_USERNAME` (text): require username + password (optional)
- `R2_BUCKETS` (text): bucket display names (CSV or JSON)
- `ADMIN_TOKEN_SECRET` (secret): token signing secret for preview/download/upload URLs
