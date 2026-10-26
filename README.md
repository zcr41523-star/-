# Smart Care · 毕设 B 模块：手势识别与控制

**AI 기반 낙상 감지 및 제스처 제어 스마트 케어 시스템 · 6조**

这是你负责的 B 模块起步项目：用摄像头识别手势，完成求助、取消误报和虚拟灯控制，并提供与 A 模块跌倒检测联调的 Python 接口。

识别采用 Google MediaPipe 的预训练 Gesture Recognizer，不需要先收集数据训练 YOLO。你自己的工作主要是手势与功能映射、连续保持判定、重复触发抑制、状态管理、接口联调和性能评估。

## 先选择怎么运行

| 方式 | 适合做什么 | 运行位置 |
|---|---|---|
| GitHub Pages（推荐先用） | 直接打开网址，调用电脑/手机摄像头识别四种手势 | AI 在访问网页的设备浏览器中运行 |
| Windows + Python | 同样的识别界面，加上与队友联调的接口 | AI 在浏览器，Python 在电脑接收事件 |
| GitHub Codespaces | 不安装本地 Python，在 GitHub 云端启动接口 | AI 仍在访问网页的浏览器，Python 在 Codespaces |

**本版本的架构选择：为方便在 GitHub Pages 上直接运行，把手势推理放在浏览器。它与最初“全部 AI 在 PC 的 Python 中运行”的计划有所调整。** 如果项目最终必须由固定 PC 处理所有视频，需要另写 Python 摄像头推理入口；本版提供的事件接口和控制逻辑仍可继续使用。

GitHub 仓库页面是代码展示页，不能直接调用摄像头。不要只点开 index.html 的 GitHub 文件预览；请开启 Pages 或在 Codespaces 启动服务。

## 方式一：上传 GitHub Pages，直接用摄像头

1. 解压压缩包，进入 `smart-care-gesture` 文件夹。
2. 登录 GitHub，新建仓库，例如 `smart-care-gesture`。若使用 GitHub Free 的免费 Pages，可建立公开仓库；不要上传隐私资料。
3. 在仓库点击 **Add file → Upload files**，上传本文件夹内的文件和目录，再提交。仓库顶层应直接看到 `docs`、`backend`、`README.md`，不要再嵌套一层同名目录。上传 ZIP 本身不会解压，也不会运行项目。
4. 打开仓库 **Settings → Pages**。
5. Source 选 **Deploy from a branch**；Branch 选 **main**（如果默认分支是其他名称，选实际分支）；目录选 **/docs**；点 Save。
6. 等 GitHub 显示发布完成，点击其提供的网址，形式为 `https://你的用户名.github.io/仓库名/`。
7. 用 Windows 的 Chrome/Edge，或 iPhone 的 Safari 打开。点“启动摄像头识别”，允许摄像头权限。不要在 GitHub 文件预览或内嵌编辑器预览中测试摄像头。
8. 首次会从 jsDelivr 加载运行时，并从 Google 下载约 8.4 MB 的模型，需要能访问这些服务。打开手掌保持 1.5 秒；触发后先放下手至少 0.4 秒，再做下一个手势。

手机打开 Pages 后可直接使用手机摄像头，这时识别在手机中完成；它不会自动把手机变成电脑的远程摄像头。

如果上传界面没有显示 `.github` 或 `.devcontainer` 这些目录，Pages 识别仍可运行；自动测试与 Codespaces 配置需要另外上传，或用 Git 提交完整目录。

### 完整 Git 上传（已经装好 Git 时）

在项目根目录打开终端，依次执行，最后一行的地址替换成你自己的真实仓库地址：

```bash
git init
git add .
git commit -m "Add smart care gesture module"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-care-gesture.git
git push -u origin main
```

本压缩包未替你创建或上传 GitHub 仓库。

## 方式二：Windows 本地运行，接队友的代码

只需 Python 3.10+，不需要 `pip install`、Node.js 或 npm。Node.js 仅用于运行开发测试。

1. 安装 Python，安装时勾选 Add Python to PATH。
2. 解压后进入项目文件夹，双击 `start_windows.bat`；也可以打开 PowerShell 执行：

```powershell
py -3 backend/server.py
```

若电脑不识别 `py`，改用 `python backend/server.py`。

3. 保持终端开启，用浏览器访问 `http://localhost:8000`。
4. 点“启动摄像头识别”，即可在本机独立模式测试。
5. 要和队友联调，展开页面“连接 Python 后端”，复制终端 `CARE_API_TOKEN=` 后面的整段令牌，粘贴并连接。只有连接成功后，识别出的动作才会发送到 Python。
6. 新开一个 PowerShell 窗口，把下方令牌替换为刚才终端打印的值，再发送一条测试跌倒事件：

```powershell
$env:CARE_API_TOKEN="这里替换为终端令牌"
py -3 examples/fall_module_client.py --report-fall
```

7. 页面应在约 1 秒轮询间隔后显示“跌倒报警中”。对摄像头做 V 字手势保持 2 秒，报警应解除。然后运行以下命令确认后端 `alarm` 已变为 `false`：

```powershell
py -3 examples/fall_module_client.py
```

关闭服务按 Ctrl+C。服务重启会清空状态与事件记录；自动生成的令牌也会变化。

## 方式三：GitHub Codespaces 云端运行

1. 上传完整项目后，在仓库点击 **Code → Codespaces → Create codespace on main**。需账号具有可用额度；使用后记得停止 Codespace。
2. 在 Codespaces 终端运行：

```bash
python backend/server.py --host 0.0.0.0 --port 8000
```

3. 打开底部 **Ports** 面板，找到 8000，点击 **Open in Browser**。保持端口为 **Private**，不要为了演示改成公开。
4. 在新浏览器标签页打开转发出的 HTTPS 地址，允许使用你当前电脑的摄像头。云端不能通过 `cv2.VideoCapture(0)` 自动访问你电脑的摄像头，因此本项目通过浏览器取帧。
5. 要启用接口，把终端令牌粘贴到页面后端设置中连接。不要在 Codespaces 的终端里把 `localhost:8000` 当作你自己电脑的网页地址；使用 Ports 面板提供的地址。

Codespaces 端口转发未在你的账号中实测；已提供配置和运行入口。

## 你的四个手势

| 手势 | 模型标签 | 动作 | 连续保持 |
|---|---|---|---|
| 张开手掌 | `Open_Palm` | `HELP`：发起求助 | 1.5 秒 |
| V 字手势 | `Victory` | `CANCEL_ALERT`：取消当前报警 | 2 秒 |
| 拇指向上 | `Thumb_Up` | `LIGHT_ON`：打开虚拟灯 | 1 秒 |
| 拇指向下 | `Thumb_Down` | `LIGHT_OFF`：关闭虚拟灯 | 1 秒 |

以上是本项目的交互约定，不是通用求救手语。当前取消动作可取消所有当前报警，包括 HELP 和 FALL_DETECTED；后续如需多个报警来源并存，需要扩展报警状态结构。

- 默认置信度阈值 75%，页面可调到 60%–95%。这是分类分数，不是识别准确率。
- 低于阈值、改变手势或超过 1.5 秒没有新推理帧，都会重新计时。每次至少需要 3 个有效推理帧，慢设备可能需要更久才触发。
- 每次动作触发后必须先出现连续 400ms 的无效/无手姿态，才能再触发任何动作。
- 只处理一只手，面向单用户。多人身份识别、远距离控制尚未实现。
- CPU 模式自动作为 GPU 初始化失败时的后备方案；推理最高约 12 帧/秒，实际取决于设备。

## 你接下来应该做什么

1. **先跑通演示**：无摄像头按钮检查状态变化；再用真实摄像头逐个识别手势。按钮模拟不能作为识别实验结果。
2. **理解两个核心文件**：`docs/gesture.js` 是手势映射与防抖；`docs/app.js` 是摄像头、MediaPipe 调用、画面和发送事件。
3. **和 A 模块联调**：让队友在实际跌倒判定成立时调用 `examples/fall_module_client.py` 中的 `report_fall()`。一个跌倒事件只生成一个 ID；不要每帧重复上报。
4. **完成误报取消闭环**：A 模块读取 `/api/state`，看到 `alarm == false` 后清除自身待确认报警。A 模块自身也应设置跌倒事件锁定/恢复机制，避免你刚取消，它下一帧又上报同一跌倒。后端不会替队友实现这个机制。
5. **再接 C 模块 App**：App 读取后端状态；你这一版负责提供事件和状态。Expo 界面、远程推送尚未包含。
6. **最后接实体灯**：当前 `light` 是虚拟布尔状态。硬件同学读取后端状态后驱动 LED/控制板，另行实现与验证；当前代码没有 GPIO/串口驱动。
7. **做实测并记录**：按 `TEST_PLAN.md` 收集误识别、漏识别、触发延迟，期中汇报可以展示真实数据。

## 文件导航

| 路径 | 用途 |
|---|---|
| `docs/index.html`、`style.css` | 中韩标注的演示界面 |
| `docs/config.js` | 固定版本的 MediaPipe 运行时、WASM 与模型地址 |
| `docs/gesture.js` | 四个手势、保持时间、重复触发限制与纯状态机 |
| `docs/app.js` | 摄像头、识别、骨架绘制、记录、Python 联调 |
| `backend/server.py` | 零依赖 Python 状态/事件 API，带令牌验证 |
| `examples/fall_module_client.py` | 给队友 A 模块使用的上报/读取示例 |
| `API.md` | 接口格式、限制与 Expo 接入示例 |
| `TEST_PLAN.md` | 真实摄像头实验与验收流程 |
| `tests/` | 可在 GitHub Actions 执行的逻辑与接口测试 |
| `.devcontainer/` | Codespaces 开发环境与 8000 端口配置 |

## 常见问题

**没有摄像头可以运行吗？** 可以先展开无摄像头演示测试 UI。真实识别需要电脑摄像头、USB 摄像头，或者在手机 Safari 中打开 Pages。

**能发给护理人员或打电话吗？** 还不能。HELP 仅改变页面/后端报警状态，没有短信、电话、Kakao 或手机推送。

**为什么打开页面后一直加载？** 模型和 JS/WASM 是联网加载的。检查 jsDelivr 与 Google Storage 访问情况；尝试 Chrome/Edge，并检查网站摄像头权限。当前未打包离线模型资源。

**为什么保持几秒仍没反应？** 看识别名称与分数；光线、完整手部入镜、角度都可能影响分类。分数低或短暂丢帧会重置计时。触发过一次后，先放下手再重做。

**为什么 Pages 不能连接 Python？** Pages 只托管静态页面，不运行本项目 Python 服务。请通过 Python 提供的 `localhost:8000` 页面，或 Codespaces 转发页面进行同源联调。这个版本故意不配置跨域连接。

**为什么刷新后状态消失？** 独立模式的状态只在当前页面内存。后端模式连接后会恢复后端当前状态，但服务器重启后也会清空。数据持久化需要后续接数据库。

## 开发测试

```bash
node --test tests/gesture.test.mjs
python -m unittest discover -s tests -v
```

这些测试验证保持时间、置信度过滤、重触发抑制、接口格式、鉴权、幂等和状态联动；它们不证明真实手势识别准确率。真实识别要使用你的摄像头按 TEST_PLAN 测试。

## 参考资料

- Google MediaPipe Gesture Recognizer：https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js
- 模型与内置手势：https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer
- GitHub Pages 发布源：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Codespaces 端口转发：https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace
- 摄像头权限与安全上下文：https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

第三方运行时与模型由其提供方授权；本项目仅通过公开 URL 加载，并未将第三方模型打包。
