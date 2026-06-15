# 车检租赁调度一体化系统

第一版项目：二手车检测报告、二手车租赁、网约车车辆入库和调度管理一体化系统。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Element Plus
- Pinia
- Vue Router
- Capacitor
- Capacitor SQLite

## 已实现模块

- 管理端登录
- 用户端登录
- 车辆档案中心
- 二手车检测录入
- 检测项目明细
- 水泡车、火烧车、重大事故车判定
- 二手车专业检测报告预览
- Word 报告导出
- 检测完成后一键入库
- 网约车预备库
- 手动入库
- 入库流水
- 二手车租赁订单
- 用户端租车
- 网约车调度任务
- 司机任务查看
- 管理端运营看板
- 手机、平板、PC 响应式布局

## 演示账号

| 端 | 账号 | 密码 |
| --- | --- | --- |
| 管理端 | admin | 123456 |
| 用户端 | user | 123456 |
| 司机用户 | driver | 123456 |

## 本地运行

```bash
npm install
npm run dev
```

访问：

```text
http://localhost:5173/
```

## 构建

```bash
npm run build
```

构建产物在 `dist` 目录。

## 安卓打包

首次添加安卓工程：

```bash
npm run build
npm run cap:add:android
npm run cap:sync
npm run cap:open:android
```

后续修改前端后：

```bash
npm run build
npm run cap:sync
npm run cap:open:android
```

在 Android Studio 里可以继续生成 APK 或 AAB。

## SQLite 说明

- `src/db/schema.ts` 定义了共用 SQLite 表结构。
- `src/db/sqliteClient.ts` 是 Capacitor SQLite 的 TypeScript 客户端。
- 当前浏览器开发环境使用 `localStorage` 降级存储，方便 PC 端预览和调试。
- 打包安卓后可以把 `fleetRepository` 的持久化方法逐步替换为 `sqliteClient.run/query`，表结构已经按 SQLite 设计好。

## 核心业务联动

1. 管理端录入检测信息。
2. 生成二手车专业检测报告。
3. 检测合格时可自动进入网约车预备库。
4. 入库后车辆状态同步为“预备库”。
5. 预备库车辆可以创建租赁订单。
6. 预备库车辆可以创建网约车调度任务。
7. 租赁或调度后车辆状态自动变化。

## 主要目录

```text
src/
  components/        通用组件
  db/                SQLite 表结构、种子数据、数据库访问层
  layouts/           管理端和用户端布局
  router/            路由
  services/          报告模板和导出
  stores/            登录态和业务数据状态
  styles/            响应式样式
  types/             业务类型
  views/admin/       管理端页面
  views/user/        用户端页面
```

## 下一版建议

- 完整接入安卓端 SQLite CRUD。
- 增加拍照上传和图片压缩。
- 增加电子签名。
- 增加 PDF 导出。
- 增加租赁合同模板。
- 增加维修保养工单。
- 增加地图定位和车辆轨迹。
- 增加权限配置页面。
- 增加数据备份和恢复。
