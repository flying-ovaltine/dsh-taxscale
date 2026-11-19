# 税衡 · TaxScale（DSH 版）

三十年从业的税务总监。三个 Agent Skill：查错、算税填表、审单据。由 WorkBuddy 专家包迁移而来，转成 DSH 可装载格式。

## 包含什么

```
dsh-taxscale/
├── plugin.json              # Agent Plugins 1.0 清单（Bridge 读它识别包）
├── package.json             # DSH 原生组合包清单（dsh.bundle）
├── cordis.patch.yml         # patch：声明元数据 + 三个 skill
├── index.js                 # 入口：把三个技能注册进宿主技能表
└── skills/
    ├── tax-diagnosis/       # SKILL.md + references/ + templates/（查）
    ├── tax-filing/          # SKILL.md + references/ + templates/（算）
    └── tax-review/          # SKILL.md + references/ + templates/（审）
```

三个技能：

| 技能 | 干什么 | 触发场景 |
|---|---|---|
| tax-diagnosis | 报表穿透验数、七组差异、风险定级、优惠与临界点、合同条款 | 给报表做税务体检 |
| tax-filing | 增值税/附加/印花/所得税/个税算税，逐栏填报，办税流程材料 | 算某一期该缴多少、表怎么填 |
| tax-review | 逐张审单据能否入账、抵扣、税前扣除，三流一致 | 给一批凭证发票做审核 |

## 在 DSH 上的适配（v1.4.0）

原包（v1.3.0）把三个技能写在 `cordis.patch.yml` 的 `meta.skills` 里，`index.js` 的 `apply()` 是空的。**DSH 不消费这个字段**：技能只能来自文件系统 provider（`dsh-skill-filesystem`，默认不启用）或插件自己调用 `ctx.skills.register(...)`。照原样安装会得到一个装了等于没装的空壳。

v1.4.0 只补了这一层，**技能的正文一个字没改**：

- `index.js` 增加 `inject = ['skills']`，逐个读取 `skills/<id>/SKILL.md`，解析 frontmatter 的 `name` / `description`，用 `ctx.skills.register({ name, description, content, resourceBase: { kind: 'directory', path } })` 注册。
- `resourceBase` 指向该技能自己的目录，`references/` 与 `templates/` 才能被加载方按需读取。
- 单个技能读坏只告警、不中断启动；宿主没有 `skills` 服务时只告警一次。
- 新增 `test/smoke.mjs`：`node --test test/smoke.mjs` 会核对三个技能都注册、正文与原文一致、references/templates 数量齐全。

`cordis.patch.yml` 里的 `meta.skills` 保留不动——它对其他 harness 仍然有意义，只是 DSH 这边不再依赖它。

## 安装（三选一）

### 方式一：作为 DSH 组合包安装（推荐）

需要有 `dsh` 命令行工具。本机当前未安装 dsh CLI，以下为通用命令：

```bash
dsh plugin --profile desktop add ./dsh-taxscale
# 或指向本目录的绝对路径
dsh plugin --profile desktop add D:/workbuddy运行内存/2026-11-19-13-04-21/dist/dsh-taxscale
```

装完重启 DSH。若插件面板列出「财税合规检测 / 报税测算与填报 / 单据合规审核」三个技能，即加载成功。

### 方式二：只装技能（无需命令行）

把 `skills/` 下的三个文件夹整个拷进 DSH 的全局技能目录：

```
~/.dsh/skills/tax-diagnosis/
~/.dsh/skills/tax-filing/
~/.dsh/skills/tax-review/
```

每个目录里必须保留 `SKILL.md`（DSH 靠它发现技能）。若 DSH 装了 Agent Skills 管理插件，在「设置 → Agent Skills」里刷新/重新扫描即可。

### 方式三：装了 Agents Plugins Bridge 的情况

Bridge 会读取根目录的 `plugin.json`，自动识别 `skills/` 目录并挂载为隔离的 skill 行。把整个 `dsh-taxscale/` 目录按 Bridge 的安装流程导入即可。

## 兼容性

- 目标 DSH：0.1.x / 0.2.x（SKILL.md 格式为两版通用）
- 技能无运行时依赖、无 UI 界面、不注入槽位，因此不会因缺少客户端服务而挂起
- 政策口径截止 2026-11-19；申报表行次、减免代码每年可能微调，SKILL.md 内已注明「以当期表样为准」

## 边界

不出鉴证意见、不签字、不代持纳税人身份提交申报；事实触及虚开（刑法 205 条）或逃税（201 条）时停止税负优化讨论，转执业税务师与刑事律师。

## 来源

由 WorkBuddy 专家「税衡 / TaxScale」v1.3.0 迁移。原始包在：
`~/.workbuddy/plugins/marketplaces/my-experts/plugins/taxscale/`
