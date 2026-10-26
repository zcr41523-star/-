# 团队接口协议 v1

后端启动：`python -m uvicorn backend.app:create_app --factory --host 0.0.0.0 --port 8000`。
环境变量：`CARE_TOKEN` 必填至少 16 字符，`CARE_INPUT_MODE=browser|pc` 默认 browser，`CARE_DB` 可覆盖 SQLite 路径，`CARE_ORIGINS` 逗号分隔允许的浏览器 origin。修改环境变量后重启服务。

## 请求

`GET /api/health` 无需令牌，返回 `{"status":"ok","input_mode":"browser","version":"1.0.0"}`。

`GET /api/state` 和 `POST /api/events` 均需 `Authorization: Bearer <CARE_TOKEN>`。令牌用于小组原型访问控制；所有持有者权限相同，source 是调用者声明，不是设备身份验证。

事件 JSON 示例：

```json
{"id":"7aef90ea-d397-49b8-b2fe-9a23df3d1228","action":"FALL_DETECTED","source":"fall"}
```

`id` 必须 UUID，同一逻辑事件重试使用相同 ID；action 只允许 HELP、CANCEL_ALERT、LIGHT_ON、LIGHT_OFF、FALL_DETECTED。source 为 browser、pc、fall；simulation 明确被拒绝。FALL_DETECTED 必须来自 fall，fall 不能发送其他动作。多余字段拒绝。后端接收的是已通过保持判定的动作，不接收原始视频或逐帧分数，因此它不能证明客户端真的保持了手势。

## 响应

成功：

```json
{"duplicate":false,"state":{"alert":true,"light":false,"revision":1,"last_event_id":"7aef90ea-d397-49b8-b2fe-9a23df3d1228","input_mode":"browser"}}
```

`GET /api/state` 直接返回 state 对象。alert、light 是布尔值。revision 是服务器接收的新事件总数，前端用它防止旧轮询响应覆盖新状态。重复的相同 ID 和内容返回 duplicate=true，不改状态或 revision；同 ID 不同内容返回 409。SQLite 事务串行化事件，重启保留。

|错误码|含义|
|---|---|
|401|缺少/错误令牌|
|409|输入来源与运行模式不一致、模拟写入或 ID 内容冲突|
|422|UUID、action、source、额外字段或跌倒来源不合法|

HELP / FALL_DETECTED 将 alert 设 true；CANCEL_ALERT 解除**处理时的当前报警**；LIGHT_ON/OFF 设置虚拟灯。没有真实灯命令、手机通知或 SMS。

服务按事务处理顺序更新状态，不提供时钟排序或多报警 episode 管理。网络断开时不要排队重放很早的 CANCEL_ALERT，以免取消新报警。客户端在提交超时后应显示“结果未知”，先读 state；当前两个入口都不自动重放旧动作。需要显式重试时仅复用同一事件 ID，并先确认不会覆盖新的事件语义。正式多用户系统需要会话/报警 ID、角色鉴权和保留策略。

## A 模块

复用 `examples/fall_module.py` 的 `report_fall(client, episode_id)`。它不包含跌倒算法。A 模块需自己实现“站立/正常 → 一次已确认跌倒 → 已处理/恢复”的 episode 状态机；持续躺倒时不应每帧生成 UUID。在人工复位或恢复后发生新跌倒，才生成新 episode ID。

## C 模块 / Expo

复用 `examples/expo-state.tsx`。iPhone 与 PC 同 Wi-Fi，baseUrl 用 `http://电脑IPv4:8000`，不能用手机的 localhost。PC 后端绑定 0.0.0.0，Windows 防火墙允许专用网络。Expo/iOS 的 HTTP 网络策略还需实机验证，HTTPS 后端更适合正式演示。轮询每秒一次，卸载组件取消；断线显示旧状态风险。示例尚未在实际 Expo 项目中编译或验证，不代表已经完成 App。

## 安全边界

不要把令牌写进公开源码、截图、提交记录或 URL。公共 Pages 不能安全存储服务端密钥，需由操作者手动输入短期演示令牌。后端未提供公网速率限制、用户角色、敏感日志脱敏网关或完整运维体系，仅用于受控小组联调。健康检查不暴露令牌；CORS 不是鉴权。团队使用完毕停止后端或撤回端口公开访问。
