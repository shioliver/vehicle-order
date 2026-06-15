# AWS Amplify Hosting 部署指南

本指南将引导你把 `vehicle-rental-inspection-dispatch` 项目通过 **AWS Amplify Hosting** 部署上线。
基础设施使用 **AWS CDK (TypeScript)** 一键创建，区域默认 `ap-northeast-1`（东京）。

---

## 架构概览

```
GitHub Repo  →  AWS Amplify Hosting (CI/CD + CDN + HTTPS)
                       │
                       ▼
              用户浏览器（HTTPS）
                       │
                       ▼
            DeepSeek API（用户在抽屉里填 Key 直连）
```

- **Amplify Hosting**：自带全球 CDN、自动 HTTPS、git push 自动构建
- **DeepSeek 调用**：默认让最终用户在 AI 检测助手抽屉里双击标题填入自己的 Key（最安全）
- **可选**：在 Amplify 后台或 CDK 里注入 `VITE_DEEPSEEK_API_KEY`，给所有用户统一 Key（构建产物会包含 Key，注意不要公开仓库）

---

## 一、准备工作（你需要先做的）

### 1. 注册 / 登录 AWS

确保已有可用账号，**强烈建议**先开启 MFA。

### 2. 创建 IAM 用户并配置 AccessKey

- 进入 IAM → 用户 → 创建用户
- 附加策略（首次使用可用 `AdministratorAccess`，后续可缩小到以下集合）：
  - `AdministratorAccess-Amplify`
  - `AWSCloudFormationFullAccess`
  - `IAMFullAccess`
  - `AmazonS3FullAccess`
  - `CloudWatchLogsFullAccess`
- 创建访问密钥（CLI 用），妥善保存

### 3. 本地环境

```bash
# Node.js 18+
node -v

# 安装并配置 AWS CLI
brew install awscli       # 或 https://aws.amazon.com/cli/
aws configure              # 输入 AccessKeyId / SecretAccessKey / 区域 ap-northeast-1

# 全局安装 CDK
npm install -g aws-cdk
cdk --version              # 至少 2.150.0
```

### 4. GitHub 仓库

- 把整个项目（包括 `infra/` 和 `vehicle-rental-inspection-dispatch/`）推到 GitHub。
- 创建一个 GitHub Personal Access Token（Settings → Developer settings → Personal access tokens (classic)）：
  - 权限勾选 **`repo`** 和 **`admin:repo_hook`**
  - 生成后立刻复制保存（页面关闭后看不到了）

---

## 二、首次部署

### 1. 安装 CDK 项目依赖

```bash
cd infra
npm install
```

### 2. CDK Bootstrap（每个账号 + 区域只需一次）

```bash
npx cdk bootstrap aws://<账号ID>/ap-northeast-1
```

> 账号 ID 可在 AWS 控制台右上角点击账号名查看，或用 `aws sts get-caller-identity` 查询。

### 3. 设置必需的环境变量

```bash
export GITHUB_OWNER=你的GitHub用户名
export GITHUB_REPO=车辆检测系统          # 仓库名
export GITHUB_BRANCH=main                # 部署分支
export GITHUB_TOKEN=ghp_xxxxxxxxxxx      # 上一步创建的 Token
# 可选：统一为所有用户注入 DeepSeek Key
# export DEEPSEEK_API_KEY=sk-xxxxxxxx
```

### 4. 预览变更并部署

```bash
npx cdk synth      # 检查生成的 CloudFormation 模板
npx cdk diff       # 与现有栈对比
npx cdk deploy     # 真正部署
```

部署成功后，你会在终端看到：

```
Outputs:
VehicleInspectionAmplifyStack.AmplifyAppId         = d12abcxyz...
VehicleInspectionAmplifyStack.AmplifyDefaultDomain = https://main.d12abcxyz....amplifyapp.com
VehicleInspectionAmplifyStack.AmplifyConsoleUrl    = https://ap-northeast-1.console.aws.amazon.com/...
```

### 5. 触发首次构建

CDK 会自动配置 webhook，但首次需要手动触发一次：

- 打开 `AmplifyConsoleUrl` 对应的链接
- 找到刚创建的 App → 进入 `main` 分支 → 点击 **Run job**
- 第一次构建大约 3~5 分钟

构建成功后，访问 `AmplifyDefaultDomain` 即可看到上线的系统。

---

## 三、后续更新

```bash
git push origin main
```

Amplify 会自动检测到提交，重新构建并部署。

如果改了 `infra/` 里的 CDK 代码：

```bash
cd infra
npm run deploy
```

---

## 四、用户使用须知

由于生产环境**没有 DeepSeek API 代理**，每个用户首次使用 AI 检测助手时需要：

1. 进入 **检测录入** 页
2. 点击右下角 🪄 **AI 检测助手**
3. **双击标题** 「AI 检测助手」 → 弹出配置框
4. 填入个人 DeepSeek API Key（在 https://platform.deepseek.com 申请）
5. 点击 **保存**

Key 仅保存在用户浏览器的 localStorage，不会上传到服务器。

---

## 五、域名与 HTTPS

Amplify 默认提供 `https://main.<appId>.amplifyapp.com`，已经是 HTTPS（满足麦克风权限要求）。

如需自定义域名（暂不在本次范围内）：

- Amplify 控制台 → Domain management → Add domain
- 自动签发 ACM 证书并绑定 DNS

---

## 六、常见问题

| 问题 | 解决 |
| --- | --- |
| 构建失败：`appRoot not found` | 检查 `amplify.yml` 中的 `appRoot` 与仓库目录名一致（`vehicle-rental-inspection-dispatch`）|
| 部署成功但页面空白 | 浏览器 Network 看 `index.html` 是否正确加载，确认 SPA rewrite 规则生效 |
| 麦克风权限弹窗不出现 | Amplify 默认是 HTTPS，确认浏览器没有屏蔽，参考组件内的引导对话框 |
| AI 助手提示 `NO_API_KEY` | 用户没填 DeepSeek Key，按"用户使用须知"配置 |
| GitHub Token 失效 | 在 GitHub 重新生成 Token，重新执行 `cdk deploy` |

---

## 七、月成本估算

- Amplify Hosting：每月构建分钟数前 1000 分钟免费、流量前 15 GB 免费
- 小流量预计 **$0~5 USD/月**
- 仅当流量很大或频繁部署时才会显著增加

---

## 八、销毁所有资源

```bash
cd infra
npx cdk destroy
```

将删除 Amplify App 与所有关联构建记录（不可恢复）。
