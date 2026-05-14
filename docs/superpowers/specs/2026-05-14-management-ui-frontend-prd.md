# OpenCode 远程平台管理前端 PRD

## 1. 产品背景

OpenCode 远程平台用于安装、配置、启动 OpenCode，并通过 FRP、Cloudflare Tunnel 等方式安全暴露到网络。当前项目已有 CLI、服务端 API、Tauri invoke 壳、`ManagementClient` 合同和部分管理页面逻辑，但缺少一个真正可交互运行的管理前端。

本 PRD 定义管理前端的功能范围与交互行为，目标是把现有“字符串式管理 UI 骨架”升级为可使用的前端应用。

## 2. 产品目标

### 2.1 核心目标

管理前端需要帮助用户完成以下闭环：

1. 检测当前运行环境。
2. 查看 OpenCode、oh-my-openagent、frpc、cloudflared 等依赖状态。
3. 显式安装、配置、启动或停止相关工具。
4. 配置 OpenCode 与 oh-my-openagent。
5. 配置公网访问入口，例如 FRP endpoint 或 Cloudflare Tunnel endpoint。
6. 查看运行状态、日志、错误原因和恢复建议。
7. 在服务器 Web 与 Tauri 桌面端复用同一套前端交互逻辑。

### 2.2 非目标

以下内容不在本阶段 PRD 范围内：

- 不定义视觉风格、颜色、字体、间距、动效。
- 不定义具体页面布局。
- 不实现完整账号体系，只要求支持已有服务端鉴权态。
- 不在前端直接执行 shell、读写本地文件、管理 systemd。
- 不把 token、password、secret 明文持久化到前端。
- 不要求前端绕过后端能力限制直接控制系统资源。

## 3. 用户角色

### 3.1 服务器管理员

运行服务器 Web 管理端，负责：

- 配置 FRP server、Caddy、frp-panel。
- 检测服务器上的 OpenCode、Bun、Docker/Compose。
- 启动服务器本机 OpenCode。
- 创建或启用公网 endpoint。
- 查看服务状态与日志。

### 3.2 桌面端用户

运行 Tauri 桌面端，负责：

- 检测本机 OpenCode、Bun、oh-my-openagent、frpc、cloudflared。
- 管理本机 OpenCode 配置。
- 启动本机 OpenCode。
- 连接远端 FRP server。
- 查看本机公网访问地址与 frpc 状态。

### 3.3 高级用户 / 调试用户

需要查看详细诊断信息，包括：

- 运行命令结果。
- 日志。
- API 错误。
- FRP 连接失败原因。
- 配置备份与恢复记录。

## 4. 运行模式

前端必须支持两种运行模式。

### 4.1 服务器 Web 模式

前端通过 HTTP `ManagementClient` 调用服务端 API。

服务器 Web 模式下可用能力包括：

- 查看服务器 runtime 信息。
- 检测服务器依赖。
- 管理服务器 OpenCode 实例。
- 管理服务端 FRP server。
- 管理公网 endpoint。
- 查看服务端工具日志。
- 管理 OpenCode 与 oh-my-openagent 配置。

服务器 Web 模式下不应出现仅桌面端可用的本机 frpc 操作入口。

### 4.2 Tauri 桌面模式

前端通过 Tauri invoke bridge 调用本机能力。

Tauri 桌面模式下可用能力包括：

- 查看本机 runtime 信息。
- 检测本机依赖。
- 管理本机 OpenCode 实例。
- 管理本机配置文件。
- 配置并启动 frpc。
- 连接服务器 FRP 服务端。
- 查看本机工具日志。

Tauri 桌面模式下不应出现仅服务器可用的 systemd、Caddy、FRP server 管理操作。

## 5. 全局交互原则

### 5.1 能力驱动

前端不得根据 URL 或构建环境硬编码功能可见性，而应根据 `RuntimeCapabilities` 判断功能是否可用。

当某项能力不可用时：

- 不允许执行对应操作。
- 需要说明不可用原因。
- 如果存在替代流程，需要给出下一步建议。

### 5.2 显式动作

前端不得自动安装、配置、启动 OpenCode 或公开 endpoint。

以下行为必须由用户明确触发：

- 安装工具。
- 启动 OpenCode。
- 停止 OpenCode。
- 修改配置。
- 应用 preset。
- 恢复 backup。
- 启用公网 endpoint。
- 启动 FRP 或 Cloudflare Tunnel。

### 5.3 安全默认

公网 endpoint 默认应为 disabled 状态。

启用 endpoint 前必须完成安全检查：

- OpenCode 是否设置访问密码。
- endpoint 是否有访问保护方式。
- FRP token 或 secret 是否已配置。
- 目标端口是否可达。
- 域名或公网地址是否有效。
- 当前服务是否正在运行。

检查失败时不得启用 endpoint，并需要显示失败项与修复建议。

### 5.4 可恢复

所有高风险操作必须有恢复路径：

- 保存配置前创建备份。
- 应用 preset 前创建备份。
- 恢复 backup 前确认目标配置。
- 启动失败后展示失败原因和下一步建议。
- endpoint 启用失败后保持原状态。

### 5.5 日志脱敏

前端显示日志、命令、错误信息时必须隐藏：

- password。
- token。
- secret。
- Authorization header。
- Basic Auth 凭据。
- 可能包含密钥的 URL query。

## 6. 信息架构

本阶段管理前端包含以下功能域：

1. Dashboard：总览与下一步建议。
2. Tools：工具检测、安装与进程控制。
3. Config：OpenCode 与 oh-my-openagent 配置管理。
4. Endpoints：公网入口管理。
5. FRP：FRP server/client 管理。
6. Settings：安全、运行时、备份、诊断设置。
7. Logs / Jobs：操作结果、任务状态与日志查看。

功能域不等同于固定页面布局，具体实现可以按页面、抽屉、弹窗或流程向导组织，但必须覆盖这些能力。

## 7. Dashboard 功能需求

### 7.1 运行时状态

Dashboard 需要展示当前运行模式：

- server。
- desktop。
- unavailable 或未知状态。

需要展示当前能力摘要：

- 是否可管理 FRP server。
- 是否可管理 FRP client。
- 是否可访问本地文件。
- 是否可管理本机进程。
- 是否可管理 systemd。
- 是否可安装服务器服务。

### 7.2 关键资源摘要

Dashboard 需要展示：

- OpenCode 工具实例数量。
- OpenCode 当前运行状态。
- oh-my-openagent 配置状态。
- endpoint 数量与启用状态。
- FRP 当前状态。
- 当前公网访问地址，如果存在。
- 最近一次操作结果。

### 7.3 下一步建议

前端需要根据状态给出下一步建议：

- 未检测工具：建议先运行检测。
- OpenCode 未安装：建议安装或配置路径。
- OpenCode 未启动：建议启动。
- 未设置密码：提示先设置 `OPENCODE_SERVER_PASSWORD`。
- FRP 未配置：提示进入 FRP 配置。
- endpoint 未启用：提示完成安全检查后启用。
- 公网访问不可达：提示查看诊断。

### 7.4 刷新交互

Dashboard 需要支持手动刷新。

刷新时需要重新请求：

- runtime info。
- tool instances。
- tool detection。
- endpoints。
- FRP status。

刷新失败时保留上一次成功数据，并展示刷新错误。

## 8. Tools 功能需求

### 8.1 工具检测

用户可以触发工具检测。

检测范围至少包括：

- OpenCode。
- Bun。
- oh-my-openagent。
- frpc。
- cloudflared。
- Docker / Docker Compose，服务器模式需要。
- Caddy，服务器模式需要。

检测结果需要包含：

- 工具名称。
- 是否检测到。
- 版本，如果可用。
- binary path，如果可用。
- 配置目录，如果可用。
- 缺失时的建议操作。

### 8.2 工具实例列表

前端需要展示已配置工具实例。

每个工具实例至少包含：

- 实例 ID。
- 工具类型。
- 显示名称。
- host type。
- 安装状态。
- 当前运行状态。
- 默认端口。
- 当前端口。
- 配置目录。

### 8.3 安装工具

当工具缺失且当前运行时支持安装时，用户可以发起安装。

安装前需要确认：

- 工具类型。
- 目标目录。
- 版本，若用户指定。
- 安装动作可能影响的文件路径。

安装后需要展示 job 状态：

- queued。
- running。
- succeeded。
- failed。

安装失败时需要展示错误信息和重试入口。

### 8.4 启动 / 停止 / 重启工具

用户可以对支持的工具实例执行：

- start。
- stop。
- restart。

交互要求：

- 操作发起后进入 pending 状态。
- 操作未完成前，同一实例不能重复提交同类操作。
- 成功后刷新实例状态。
- 失败后展示失败原因。
- 如果失败与端口占用有关，需要提示检查端口。
- 如果失败与密码缺失有关，需要提示配置密码。

### 8.5 工具日志

用户可以查看工具日志。

日志需要支持：

- 按实例查看。
- 按时间倒序或顺序读取。
- 显示日志等级。
- 显示时间。
- 显示脱敏后的 message。
- 手动刷新。
- 清楚标识日志读取失败。

## 9. Config 功能需求

### 9.1 配置目标

配置管理至少支持：

- OpenCode 配置。
- oh-my-openagent 配置。

每个配置目标由以下信息确定：

- tool instance ID。
- kind。
- path，可选。

### 9.2 读取配置

用户进入配置功能时，前端需要读取当前配置内容。

读取结果包括：

- 配置内容。
- 更新时间，如果可用。
- 配置路径，如果可用。
- 读取失败原因。

如果配置不存在，需要显示“未创建”状态，并允许用户创建。

### 9.3 编辑配置

用户可以编辑配置内容。

保存前需要做基础校验：

- 内容不能为空。
- 如果是 JSON，必须是合法 JSON。
- 如果是 TOML/YAML 等格式，需要由后端返回校验结果或保存错误。
- 不允许保存明显包含未脱敏 secret 的日志片段。

### 9.4 保存配置

保存配置时：

1. 前端提交目标与内容。
2. 后端保存前创建备份。
3. 保存成功后刷新配置。
4. 保存失败时保留用户未保存内容。
5. 保存失败时展示错误原因。

### 9.5 Preset 管理

前端需要支持查看可用 preset。

用户可以应用 preset。

应用前需要确认：

- preset 名称。
- 目标配置。
- 应用后将覆盖的范围。
- 是否会创建备份。

应用成功后刷新配置内容。

应用失败时保留当前配置并展示错误。

### 9.6 Backup 管理

前端需要支持查看备份列表。

备份信息包括：

- backup ID。
- 创建时间。
- 目标配置。
- 路径。

用户可以恢复备份。

恢复前需要确认：

- 恢复目标。
- backup ID。
- 当前配置会被覆盖。
- 是否需要先创建当前配置的新备份。

恢复成功后刷新配置。

恢复失败时展示错误原因。

## 10. Endpoints 功能需求

### 10.1 Endpoint 列表

前端需要展示所有公网 endpoint。

每个 endpoint 至少包含：

- ID。
- 名称。
- 域名。
- 协议。
- 目标类型。
- 目标工具实例。
- 认证方式。
- 状态。

### 10.2 Endpoint 类型

至少支持以下 endpoint 类型：

- server-local：指向服务器本机 OpenCode。
- desktop-frp：指向桌面端通过 FRP 暴露的本机 OpenCode。
- cloudflare：指向 Cloudflare Tunnel 暴露的本机或服务器 OpenCode。

### 10.3 新建 / 编辑 Endpoint

用户可以创建或编辑 endpoint。

必填信息：

- 名称。
- 域名或公网 URL。
- 协议。
- 目标类型。
- 目标工具实例。
- 认证方式。

保存前需要校验：

- 域名或 URL 格式正确。
- 目标工具实例存在。
- 认证方式符合安全要求。
- target type 与当前运行模式兼容。

### 10.4 启用 Endpoint

用户可以启用 disabled endpoint。

启用前必须执行检查：

- OpenCode 正在运行。
- OpenCode 访问密码已配置。
- endpoint 认证方式已配置。
- FRP 或 Cloudflare 状态可用。
- 目标端口可达。
- 公网地址可生成。
- 没有明显冲突的 endpoint。

检查通过后才允许启用。

启用成功后需要展示：

- endpoint 状态。
- 公网访问地址。
- 认证方式。
- 最近一次启用操作结果。

启用失败时 endpoint 仍保持 disabled 或 previous state。

### 10.5 停用 Endpoint

用户可以停用 active endpoint。

停用前需要确认该 endpoint 将不再对公网提供访问。

停用成功后：

- endpoint 状态变为 disabled。
- 保留 endpoint 配置。
- 不删除历史配置。

### 10.6 Endpoint 诊断

每个 endpoint 需要支持诊断。

诊断内容包括：

- 目标工具是否运行。
- 本地端口是否可达。
- FRP/Cloudflare 是否可达。
- 认证配置是否完整。
- 最近错误原因。
- 修复建议。

## 11. FRP 功能需求

### 11.1 FRP 模式识别

前端需要根据 capabilities 判断当前 FRP 管理模式：

- server：管理 FRP server / frp-panel。
- client：管理 frpc。
- unavailable：当前运行时不支持 FRP 管理。

### 11.2 FRP 状态展示

需要展示：

- mode。
- running。
- status。
- failure reason。
- suggestion。
- public URL。
- client 状态。
- proxy 状态。

### 11.3 服务器 FRP 管理

服务器模式下支持：

- 查看 frp-panel 地址。
- 查看 RPC 地址。
- 查看 server address。
- 查看 bind port。
- 查看 dashboard 是否启用。
- 保存 FRP server 配置。
- 启动 FRP server。
- 停止 FRP server。
- 查看连接客户端。
- 生成桌面端连接所需信息。

保存配置前需要校验：

- panel URL 格式。
- RPC URL 格式。
- server address 不为空。
- bind port 合法。
- auth token ref 不为空。
- 不直接显示 token 原文。

### 11.4 桌面 FRP 管理

桌面模式下支持：

- 填写服务器地址。
- 填写服务器端口。
- 填写 token ref 或导入连接配置。
- 选择本机 OpenCode 端口。
- 配置 subdomain 或 proxy name。
- 生成 frpc 配置。
- 启动 frpc。
- 停止 frpc。
- 查看公网 URL。
- 查看连接状态。

启动 frpc 前需要检查：

- OpenCode 本机服务已启动。
- 本机端口可达。
- 服务器地址存在。
- token ref 存在。
- subdomain 或 proxy name 合法。
- frpc binary 可用。

### 11.5 FRP 故障处理

前端需要根据 failure reason 给出明确提示：

- `auth_failed`：检查 token 或认证配置。
- `api_unreachable`：检查 frp-panel API 地址和网络。
- `rpc_unreachable`：检查 frp-panel RPC 地址。
- `proxy_not_ready`：等待 proxy 启动或检查配置。
- `local_service_unreachable`：检查本机 OpenCode 是否运行。
- `client_not_ready`：检查 frpc 是否在线。
- `timeout`：提示重试并检查网络。
- `unknown`：提示查看日志。

## 12. Cloudflare Tunnel 功能需求

### 12.1 Tunnel 模式

前端需要支持两种 Cloudflare Tunnel 流程：

- quick tunnel。
- named tunnel。

### 12.2 Quick Tunnel

用户可以选择本地端口并生成 quick tunnel 启动方案。

前端需要展示：

- 本地目标地址。
- 需要执行或即将执行的命令摘要。
- 临时公网地址，如果已生成。
- cloudflared 检测状态。
- 错误信息。

### 12.3 Named Tunnel

用户可以配置：

- hostname。
- tunnel name。
- 本地目标端口。
- DNS 路由信息。

前端需要按步骤展示流程状态：

1. 登录 Cloudflare。
2. 创建 tunnel。
3. 配置 DNS。
4. 写入 tunnel config。
5. 启动 tunnel。
6. 验证公网访问。

每一步都需要有成功、失败、重试状态。

## 13. Settings 功能需求

### 13.1 运行时信息

Settings 需要展示：

- 当前运行模式。
- 当前平台版本。
- 配置根目录。
- 可用能力。
- 管理 API 地址，服务器模式适用。
- Tauri bridge 状态，桌面模式适用。

### 13.2 安全检查

Settings 需要展示安全检查项：

- OpenCode 访问密码是否配置。
- endpoint 是否有认证。
- FRP token ref 是否配置。
- 是否存在明文 secret 风险。
- 日志脱敏是否启用。
- 配置备份是否可用。

### 13.3 备份策略

用户可以查看：

- 配置备份数量。
- 最近一次备份时间。
- 备份目录。
- 备份失败记录。

用户可以触发：

- 手动备份。
- 恢复备份。
- 清理旧备份，若后端支持。

### 13.4 诊断导出

用户可以导出诊断信息。

导出内容包括：

- runtime info。
- tool detection。
- endpoint 状态。
- FRP 状态。
- 最近 job 结果。
- 脱敏后的日志摘要。

导出内容不得包含明文 secret。

## 14. Jobs 与异步操作

### 14.1 Job 状态

所有长耗时操作需要返回并展示 job 状态：

- queued。
- running。
- succeeded。
- failed。

适用操作包括：

- 安装工具。
- 启动工具。
- 停止工具。
- 重启工具。
- 启用 endpoint。
- 停用 endpoint。
- 启动 FRP。
- 停止 FRP。
- 应用 preset。
- 恢复 backup。

### 14.2 Job 交互

前端需要支持：

- 操作提交后显示 job 结果。
- job 完成后自动刷新相关数据。
- job 失败后展示错误。
- 用户可手动重试失败操作。
- 同一资源的互斥操作不得并发提交。

### 14.3 乐观更新

默认不使用乐观更新。

状态变更必须以后端返回或刷新结果为准。

例外：可以在操作提交后临时显示 pending 状态，但不能把资源标记为 succeeded。

## 15. 错误处理

### 15.1 API 错误

API 请求失败时需要展示：

- 请求目标。
- HTTP 状态码，如果有。
- 可读错误信息。
- 是否可以重试。
- 是否需要重新登录。

### 15.2 权限错误

遇到 401 或 403 时：

- 停止后续敏感请求。
- 提示用户认证已失效或权限不足。
- 提供重新认证入口，若当前运行模式支持。
- 不清空本地未保存编辑内容。

### 15.3 网络错误

网络错误时：

- 保留最近一次成功数据。
- 显示当前数据可能过期。
- 允许用户重试。
- 不自动重复提交写操作。

### 15.4 配置错误

配置保存失败时：

- 保留用户输入内容。
- 展示后端返回的校验错误。
- 标明失败字段或失败原因。
- 不覆盖原配置。

### 15.5 运行时能力错误

如果用户尝试执行当前运行时不支持的操作：

- 阻止请求。
- 显示当前模式不支持该操作。
- 如果存在替代流程，显示替代建议。

## 16. 数据刷新策略

### 16.1 首次加载

应用首次加载时需要请求：

- runtime info。
- tool instances。
- endpoints。
- FRP status。

工具检测可以不自动执行，避免首次加载触发过多系统调用；但需要提供显式检测入口。

### 16.2 操作后刷新

以下操作成功后必须刷新相关数据：

- install tool：刷新 tool instances 与 detection。
- start / stop / restart tool：刷新 tool instances、logs、dashboard。
- save config：刷新 config。
- apply preset：刷新 config 与 backups。
- restore backup：刷新 config 与 backups。
- save endpoint：刷新 endpoints。
- enable / disable endpoint：刷新 endpoints 与 dashboard。
- save FRP config：刷新 FRP status。
- start / stop FRP：刷新 FRP status 与 endpoints。

### 16.3 手动刷新

所有主要功能域都需要支持手动刷新。

手动刷新不能丢失当前未保存表单内容。

## 17. 权限与安全

### 17.1 前端权限边界

前端只允许通过 `ManagementClient` 调用能力，不得：

- 直接执行 shell。
- 直接读写文件。
- 直接操作 systemd。
- 直接拼接命令行字符串。
- 在浏览器 localStorage 中保存 secret。

### 17.2 Secret 输入

用户输入 secret 时：

- 默认不回显。
- 保存后不再显示明文。
- 再次编辑时显示 secret ref 或 masked value。
- 日志和错误信息必须脱敏。

### 17.3 高风险操作确认

以下操作必须二次确认：

- 启用公网 endpoint。
- 停止正在运行的 OpenCode。
- 覆盖配置。
- 应用 preset。
- 恢复 backup。
- 停止 FRP。
- 删除或清理备份。

## 18. 状态与空态

### 18.1 加载态

前端需要区分：

- 首次加载。
- 局部刷新。
- 操作提交中。
- 后台 job 运行中。

### 18.2 空态

需要覆盖以下空态：

- 无工具实例。
- 未检测到工具。
- 无 endpoint。
- 无配置文件。
- 无 preset。
- 无 backup。
- 无日志。
- FRP 未配置。

每个空态都需要给出下一步动作。

### 18.3 失败态

失败态需要包含：

- 发生了什么。
- 可能原因。
- 推荐下一步。
- 是否可重试。
- 是否需要查看日志。

## 19. 验收标准

### 19.1 基础运行验收

- 前端应用可以在浏览器或 Tauri 容器中启动。
- 应用启动后能识别当前运行模式。
- 应用能通过对应 `ManagementClient` 获取 runtime info。
- 应用无后端连接时能显示可理解的错误状态。

### 19.2 Dashboard 验收

- 能显示 server / desktop 模式。
- 能显示能力矩阵。
- 能显示工具、endpoint、FRP 摘要。
- 能根据当前状态给出下一步建议。
- 刷新失败时保留旧数据。

### 19.3 Tools 验收

- 用户可以触发工具检测。
- 检测结果能显示 detected / missing。
- 用户可以安装支持的工具。
- 用户可以启动、停止、重启工具实例。
- 工具操作成功后状态刷新。
- 工具操作失败后错误可见。
- 日志能按实例查看并脱敏。

### 19.4 Config 验收

- 能读取 OpenCode 配置。
- 能读取 oh-my-openagent 配置。
- 能编辑并保存配置。
- 保存失败不丢失用户输入。
- 能查看 presets。
- 能应用 preset。
- 能查看 backups。
- 能恢复 backup。

### 19.5 Endpoints 验收

- 能列出 endpoint。
- 能创建和编辑 endpoint。
- endpoint 默认 disabled。
- 启用 endpoint 前执行安全检查。
- 检查失败时不能启用。
- 启用成功后展示公网地址。
- 停用 endpoint 后配置保留。

### 19.6 FRP 验收

- server 模式显示 FRP server 操作。
- desktop 模式显示 FRP client 操作。
- unavailable 模式不允许 FRP 操作。
- 能保存 FRP 配置。
- 能启动和停止 FRP。
- 能显示 failure reason 与 suggestion。
- auth、API、RPC、本地服务不可达等错误有明确提示。

### 19.7 安全验收

- 前端不保存明文 secret。
- 日志展示经过脱敏。
- 高风险操作有确认。
- 无权限时不能执行敏感操作。
- endpoint 启用前必须确认访问保护。

## 20. 后续迭代建议

### 20.1 第一阶段：可运行前端壳

目标：

- 建立真实前端运行入口。
- 接入 `ManagementClient`。
- 完成 Dashboard、Tools、Config、Endpoints、FRP、Settings 的基础交互。
- 保留现有服务端 API 和 Tauri invoke 合同。

### 20.2 第二阶段：完整操作闭环

目标：

- 补齐安装、启动、停止、配置保存、endpoint 启停、FRP 启停等写操作。
- 补齐 job 状态与日志。
- 补齐错误恢复建议。

### 20.3 第三阶段：公网访问诊断增强

目标：

- 增加 endpoint 可达性检测。
- 增加 FRP proxy 状态轮询。
- 增加 Cloudflare Tunnel named flow。
- 增加诊断导出。

### 20.4 第四阶段：多工具扩展

目标：

- 支持 OpenCode 以外的 AI 编程工具。
- 抽象 ToolAdapter 前端交互。
- 支持多个工具实例与多个 endpoint 的关联管理。
