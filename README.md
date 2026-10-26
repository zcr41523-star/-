# 基于 AI 跌倒检测与手势控制的智能照护系统 · B 模块

**AI 기반 낙상 감지 및 제스처 제어 스마트 케어 시스템**

本仓库实现三人毕业设计中 B 模块：MediaPipe 预训练手部识别、手势保持判定与动作控制，以及 A 模块（跌倒检测）和 C 模块（React Native + Expo）的事件接口。初始场景为固定摄像头、单用户、单只手。无需先训练 YOLO，无需安卓设备。

这是毕业设计原型。当前只实现**报警状态和虚拟灯**；未实现短信、电话、手机推送或实体 LED 控制。模拟按钮不代表 AI 识别实验，分类分数不是识别准确率。

## 1. 两阶段与数据流

阶段一：`浏览器摄像头 → MediaPipe Web → GestureGate → 本地演示状态 / POST /api/events`。
GitHub Pages 只托管 `docs/` 静态前端，推理在访问页面的设备上进行。电脑使用电脑摄像头；iPhone 使用 Safari 与手机摄像头。网页不上传视频。首次启动需要下载本仓库模型及 jsDelivr 的固定版本 JS/WASM。

阶段二：`Windows USB 摄像头 → MediaPipe Python → GestureGate → 同一 POST /api/events`。
两个入口共用 `docs/config.json`，后端通过 `CARE_INPUT_MODE=browser|pc` 拒绝另一入口的事件。运行时选择一个入口；同一入口也只应运行一个实例。它不是设备身份鉴别或多用户仲裁协议。

`A 模块 → FALL_DETECTED → 报警；B 模块 → CANCEL_ALERT → 解除当前报警；C 模块 → GET /api/state → 显示共享状态`。

|模型标签|自定义动作|连续保持|
|---|---|---|
|Open_Palm|HELP|1.5 秒|
|Victory|CANCEL_ALERT|2 秒|
|Thumb_Up|LIGHT_ON|1 秒|
|Thumb_Down|LIGHT_OFF|1 秒|

这些映射是本项目自定义的交互约定。默认分类分数阈值 0.75，可在网页或 PC 命令行修改；两端独立配置阈值，不自动同步。需要至少 3 个有效识别帧，使用单调时间计时，而非按 FPS 累计。低分、无效标签、手势变化立即清空保持；相邻有效采样间隔超过 600ms 重新保持，适用于约 2FPS 以上设备。低于此速度保守地不触发，应改善设备性能而非声称识别正常。

触发后锁定，直接换另一种有效手势也不会再次触发。必须连续观察到无有效手势至少 400ms；未观察到的视频空窗不算释放。页面后台会停止摄像头并重置；停止、断开、视频冻结均重置。重新启动需再次完成全部保持时长。PC 每次读帧失败直接停止；长读帧及处理间隔重置保持计时。

## 2. Windows 安装与第一阶段启动

在 Windows 10/11 x64 安装 Python **3.12**、Node.js **22 LTS** 与 Git。Python 安装时选 Add to PATH；以下命令均在**项目根目录** PowerShell 运行。

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe scripts/download_model.py
$env:CARE_TOKEN = [guid]::NewGuid().ToString('N')
$env:CARE_INPUT_MODE = 'browser'
.\.venv\Scripts\python.exe -m uvicorn backend.app:create_app --factory --host 0.0.0.0 --port 8000
```

不要关闭这个终端。用电脑打开 <http://localhost:8000>，点击“启动摄像头”，允许权限。连接共享后端时填写 `http://127.0.0.1:8000` 和刚才生成的令牌（可在另一条命令中查看自己设置的值，切勿发到仓库）。留空后端地址则运行本地演示。摄像头选择列表在权限允许后显示设备名称，选中后重新启动。

如果只需静态演示，无需后端或令牌：

```powershell
py -3.12 -m http.server 8080 --directory docs
```

打开 <http://localhost:8080>。不能直接双击 HTML，也不要用普通 HTTP 局域网地址测试 iPhone 摄像头：浏览器摄像头需要安全上下文，localhost 或 HTTPS。iPhone 用已发布的 GitHub Pages HTTPS 页面；拒绝权限后应在 Safari/系统设置允许相机，再重试。模型/CDN 网络失败会给出错误提示，模拟按钮仍可使用。

**停止：**网页点“停止”，后端终端按 Ctrl+C。Windows 执行策略不影响上述直接调用 python.exe 的写法，无需激活虚拟环境。

## 3. 第二阶段：正式 PC 摄像头入口

先停止浏览器摄像头和后端，再在同一终端设置：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-pc.txt
$env:CARE_INPUT_MODE = 'pc'
# CARE_TOKEN 继续使用先前值；新终端必须设置为相同值。
.\.venv\Scripts\python.exe -m uvicorn backend.app:create_app --factory --host 0.0.0.0 --port 8000
```

新 PowerShell 终端进入项目根目录，设置同一个 `CARE_TOKEN`，执行：

```powershell
$env:CARE_TOKEN = '与后端相同的令牌'
.\.venv\Scripts\python.exe -m pc.camera --camera 0 --probe
.\.venv\Scripts\python.exe -m pc.camera --camera 0 --threshold 0.75
```

窗口中显示关键点、标签、分类分数与保持比例。按 Q 结束。`--camera 1` / `--camera 2` 尝试 USB 摄像头索引，`--url` 可指定后端，`--model` 可指定模型路径。浏览器可连接后端作为只读状态面板，PC 模式下会禁用浏览器识别启动。

无法打开摄像头时检查：Windows“隐私和安全性 → 摄像头 → 允许桌面应用访问”、USB 连接、是否被 Teams/浏览器等占用。MediaPipe DLL 错误时确认 x64 Python 3.12、干净虚拟环境及 Microsoft Visual C++ 2015–2022 x64 运行库。

## 4. 团队联调

完整协议见 [接口文档](./guides/API.md)。本项目使用 UUID 事件 ID、Bearer 令牌、SQLite 事务实现去重与状态持久化。事件与去重记录保留在 `work/care.sqlite3`，重启不丢失。数据库不提交 Git。仅需单个后端进程，不添加多个服务实例。

A 模块直接复用 [examples/fall_module.py](./examples/fall_module.py)：它**不包含跌倒识别算法**。只在一次跌倒 episode 首次确认时创建 UUID，网络重试复用这个 UUID；不要每帧上报。示例上报一次后轮询，直到 B 模块 V 字取消后读到 `alert=false`。

```powershell
$env:CARE_TOKEN = '与后端相同的令牌'
.\.venv\Scripts\python.exe examples/fall_module.py
```

C 模块把 [examples/expo-state.tsx](./examples/expo-state.tsx) 放入 Expo 项目：`<CareStatus baseUrl="http://192.168.1.20:8000" token={token} />`。手机与电脑应在同一局域网，**手机访问 PC 必须使用电脑的局域网 IP，不能用 localhost**。运行 `ipconfig` 查看 IPv4，并允许 Windows 防火墙在专用网络访问 TCP 8000。此示例只读状态，没有完成推送通知；iOS 的 HTTP/ATS 与 Expo 运行环境仍需实机验证，正式联调用 HTTPS 后端。

## 5. GitHub Pages 与 Codespaces

本次选用已有公开仓库 `zcr41523-star/-`，名称为 `-` 不影响相对路径。所有本地静态资源均用 `./`，可放在任意仓库子路径。

1. 将代码推送 main。
2. 仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。
3. Actions → Deploy GitHub Pages → Run workflow。工作流先跑单元测试，再校验/下载模型并上传 `docs/`。
4. 等待工作流成功后，从部署输出打开真实网址。不要把未成功部署的预期 URL 当上线证明。

也可不使用 Actions，直接在 Pages 选择 Deploy from a branch → main → `/docs`；这时须先运行模型下载脚本，并用 `git add -f docs/models/gesture_recognizer.task` 提交模型。默认不把第三方模型二进制加入 Git，Actions 会校验并下载；本地交付目录已下载模型。不要同时混用两种发布方式。

Codespaces：Code → Codespaces → Create；`.devcontainer` 安装 Python/Node 依赖并转发 8000。在终端设 `CARE_TOKEN`，启动与 Windows 相同的 uvicorn 命令。通过 Ports 面板打开 HTTPS 8000 地址，浏览器摄像头仍来自访问该网页的设备，而不是 Codespaces 服务器。Codespaces 没有连接你的 Windows USB 摄像头，PC 入口应在 Windows 上运行。

Pages 跨域联调：启动后端前设置 `CARE_ORIGINS=https://zcr41523-star.github.io`（只有 origin，没有 `/-/` 路径）。填入 HTTPS Codespaces 后端地址。Codespaces 私有端口有 GitHub 登录层，跨域请求可能被拦；同源 Codespaces 页面最容易验证。若临时开放端口为 Public，仍须使用本项目高强度令牌，并在联调结束恢复 Private。令牌只存在页面内存，不放 URL、localStorage 或仓库。HTTPS Pages 直接调用 HTTP PC 地址可能被 mixed content/局域网访问策略拦截，推荐在 PC 的 localhost 同源联调或使用 HTTPS 后端。

## 6. 自动测试

```powershell
.\.venv\Scripts\python.exe -m pytest -q
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

GitHub Actions 在 Ubuntu/Windows 运行接口、计时契约和 Chromium 页面测试。两种语言读取同一个 `tests/gate_cases.json`，覆盖保持时长、多个有效帧、阈值、低分、切换、慢设备、间断、释放与防重复。后端覆盖跌倒→取消、灯光、鉴权、去重冲突、并发重复与持久化。浏览器测试包含子路径、模拟标记、无摄像头错误与后台重置，使用 mock 不代表真实 AI 效果。

关键直接依赖在 requirements 文件固定版本，npm 有 lockfile。`requirements-lock-windows-py312.txt` 是本次 Windows Python 3.12 全依赖快照，仅用于复现此次环境；其他系统使用标准 requirements 文件。模型是 Google 官方 float16 v1，下载脚本校验 SHA256，模型不是本组训练成果。

## 7. 核心文件与答辩重点

|文件|作用 / 应理解的内容|
|---|---|
|`docs/index.html`, `style.css`|中文响应式控制台、视频和虚拟灯|
|`docs/app.js`|设备摄像头、MediaPipe 推理、关键点绘制、生命周期和网络连接|
|`docs/config.json`|四手势动作、保持时间、阈值和释放规则的唯一默认配置|
|`docs/core.js`, `backend/gate.py`|同一计时状态机的 JS/Python 实现；候选、累计、锁定、释放|
|`backend/app.py`|FastAPI、令牌、输入校验、SQLite 原子去重与报警/灯光状态|
|`pc/camera.py`|USB 摄像头与 Python VIDEO 模式；复用相同事件协议|
|`scripts/download_model.py`|固定模型来源与 SHA256 校验|
|`examples/`|A 模块上报与 C 模块读取示例|
|`tests/`|共享状态机契约、后端接口与浏览器回归测试|
|`.github/workflows/`|CI、Pages 自动部署|
|`.devcontainer/`|Codespaces 开发环境|
|`guides/REAL_CAMERA_TEST.md`|真实摄像头实验记录模板，不预填识别效果|
|`guides/VALIDATION.md`|实际执行过的验证与未验证项|

答辩应能解释：MediaPipe 负责预训练分类，本模块负责交互约定、误触发抑制、事件状态机和团队集成；分类分数不是准确率；为何持续保持、最少帧、间断重置和释放锁四者都需要；为何模拟、本地状态和后端确认必须区分；UUID 去重解决重试而不能自动识别同一次跌倒；为什么尚不能宣称手机推送、真实灯或医疗效果。

## 官方参考

- [MediaPipe Web Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)
- [MediaPipe Python Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/python)
- [官方模型](https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task)

源码可用于本组毕业设计。第三方模型、MediaPipe 和其他依赖保留各自许可证，不宣称拥有其知识产权。发布前请由组员共同决定本组源码的开源许可证。
