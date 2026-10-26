# A/B/C 模块联调接口

## 架构

浏览器摄像头 → MediaPipe 手势分类 → 连续保持与重触发过滤 → B 模块事件 → Python 共享状态。

A 模块跌倒算法 → `FALL_DETECTED` 事件 → 同一个 Python 状态 → 页面每秒轮询，或供 C 模块 App 读取。

Python 默认仅监听 `127.0.0.1:8000`。本服务是教学原型，使用单进程内存状态，不包含数据库、推送、硬件控制或完整生产部署能力。只从 `docs/` 目录提供静态文件。

## 验证

除 `/api/health` 外的所有 API 请求需要：

```http
Authorization: Bearer 终端显示的令牌
```

未设置环境变量时，每次启动随机生成令牌；也可在启动前设置 `CARE_API_TOKEN`。不要提交令牌到 GitHub。网页只在内存中持有令牌，不写入 URL、日志导出或浏览器存储。

## GET /api/health

返回 `{"ok":true,"prototype":true}`，不返回令牌或状态。

## GET /api/state

```json
{
  "state": {"alarm":true,"alarmReason":"FALL_DETECTED","light":false,"revision":1},
  "events": [
    {"id":"939d058a-eb6d-4d8f-9990-94f3e2c8ad26","action":"FALL_DETECTED","source":"fall_detection","created_at":"2026-10-26T00:00:00+00:00"}
  ]
}
```

`created_at` 为服务器接收时间，示例日期不代表实测数据。`revision` 每执行一个新事件加一，重复提交不增加。响应附最近 50 条事件；内部最多保留 500 条，服务重启后清空。

## POST /api/events

`Content-Type: application/json`，正文最大 16 KiB。

### A 模块：报告跌倒

```json
{"id":"939d058a-eb6d-4d8f-9990-94f3e2c8ad26","source":"fall_detection","action":"FALL_DETECTED"}
```

在真实 A 模块中：

```python
import os
from uuid import uuid4
from examples.fall_module_client import report_fall, read_state

base_url = 'http://127.0.0.1:8000'
token = os.environ['CARE_API_TOKEN']

# 在你们自己的“新跌倒事件成立”分支中调用一次：
event_id = str(uuid4())
report_fall(base_url, token, event_id=event_id)

# 如需重试同一事件，复用 event_id。取消后不要继续上报同一次跌倒。
state = read_state(base_url, token)
print(state['alarm'])
```

`report_fall()` 是网络上报函数，不会识别跌倒。调用时机和重复报警抑制需要 A 模块自己实现。

### B 模块：手势事件

```json
{
  "id":"5c008ca4-e2b0-43cf-8cd8-22d1b692438d",
  "source":"gesture",
  "action":"CANCEL_ALERT",
  "gesture":"Victory",
  "confidence":0.9,
  "held_ms":2100
}
```

动作、手势和最低保持时间必须匹配 README 表格。后端允许分数 0.60–1，具体客户端阈值由页面设置决定。前端防抖是真正的时序判定；后端仅校验提交的数据格式，不能验证相机真实性。

成功响应与 GET 类似，并含 `duplicate: false`。最近 500 条事件内，复用同一 UUID 和相同内容不会重复执行，返回 `duplicate: true`；同 ID 修改操作会返回 400。超过保留窗口或服务重启后不保证去重。客户端提供的时间会被服务器接收时间替换。

错误：401 令牌不正确；400 格式/内容不正确；413 正文过大或空正文；415 Content-Type 错误；404 接口不存在。客户端每次请求 5 秒超时，手势发送失败后不自动重放过期指令。网络超时可能发生在后端已执行之后，因此界面会标记“未确认执行”，需要查询状态。

## C 模块：React Native / Expo 接入示意

```javascript
// 这是集成片段，不是完整 Expo App。
// 在真实手机上，127.0.0.1 指手机自身；联调 PC 时要使用 PC 的局域网 IP。
const API_BASE = 'http://192.168.0.100:8000'; // 替换为实际电脑 IP

async function readCareState(token) {
  const response = await fetch(`${API_BASE}/api/state`, {
    headers: {Authorization: `Bearer ${token}`},
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()).state;
}
```

真机访问 PC 接口需把 Python 监听地址改为 `--host 0.0.0.0`，两台设备处于同一受信局域网，并允许 Windows 防火墙中对应的私有网络端口。App 的 HTTP 限制取决于构建配置，本版未验证 Expo 真机联网；正式远程接入应提供 HTTPS 服务。不要把当前开发服务直接裸露到公网。

本项目没有跨域 CORS：网页使用同源服务；原生 App 的网络调用不等同于浏览器跨域调用。HTTPS Pages 页面对 HTTP 电脑 API 还会遇到浏览器安全限制，因此请用 README 的 Python 页面完成联调。

## 报警取消语义

只有一个当前报警槽位，`HELP` 或 `FALL_DETECTED` 都会把 `alarm` 设为 true；`CANCEL_ALERT` 清除当前报警。灯光是独立状态，取消报警不影响灯光。多个事件并发时按服务器接收顺序处理；不能把它当成多用户报警队列。
