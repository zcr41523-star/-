# 本次验证记录

执行日期：2026-10-26。环境：Windows x64、Python 3.12.4、Node 24.22.1、MediaPipe Python/Web 0.10.21。模型 float16 v1 SHA256：`97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482`。

## 已实际执行

- `python -m pytest -q`：**24 项通过**，包含 18 组双语言共享计时契约与 6 组 API 测试；AnyIO 产生一条依赖弃用警告，不影响测试结果。
- `node --test tests/gate.test.js`：**19 项通过**，四种手势保持、短手势、低分、换手势、视频间断、2FPS、帧数要求、锁定和释放、阈值边界、时钟回退与灯光/报警状态转换。
- Playwright + 实际 Chromium：**2 项通过**，验证 `/docs/` 子路径静态资源、模拟事件标记、报警/灯光、摄像头权限失败提示、后台计时重置、共享状态确认与 PC 模式禁用。网络和权限在这些回归测试中被 mock；不代表真实识别。
- 启动真实 uvicorn 服务，通过 HTTP 完成 health → FALL_DETECTED → 重复 ID → CANCEL_ALERT → LIGHT_ON → LIGHT_OFF → state；状态与 revision 正确，静态页面返回 200，模型返回 8,373,440 字节。
- `node scripts/verify_model_browser.mjs`：真实 CDN JS/WASM、真实模型加载成功；使用 Chromium 合成摄像头进行 VIDEO 推理，输出“无有效手势 / 0.000”；停止计时重置、390px 宽度无页面横向溢出、无未捕获 JS 错误。
- MediaPipe Python 实际创建 GestureRecognizer 并对三帧 640×480 空白图像执行 VIDEO 推理，均返回 0 只手；证明运行时与模型可执行，不证明手势效果。
- `python -m pc.camera --camera 0 --probe`：实际可读取 640×480 画面，随后释放；未做真实手部动作实验。
- `python -m pc.camera --camera 99 --probe`：返回退出码 1，并显示中文“无法打开”及 Windows 权限/USB/占用/摄像头索引建议。
- 下载模型并记录 SHA256；npm 依赖审计结果为 0 个已知漏洞（只针对 npm 依赖，非完整系统安全审计）。

运行环境曾出现沙箱阻止外网/DLL 与切换 Windows 账户引发 pytest 临时目录权限错误。通过在有网络/DLL 权限的进程下载/运行依赖，并在原账户重新运行 pytest，完成上述验证；这些环境失败未当作功能通过。

## 未验证，不能宣称完成

- 没有真实手部的四手势成功率、误触发率、距离和延迟实验。分类分数、空白帧、合成摄像头、模拟按钮均不能作为准确率证据。
- iPhone Safari 真机摄像头与前后台恢复、实际 USB 摄像头完整四手势流程仍需用户按模板执行。
- A 模块实际跌倒算法、其 episode 去重与恢复规则未包含；这里只验证事件接口。
- Expo 示例尚未在队友真实 App 中编译/运行；iOS 网络策略、局域网、防火墙和 Codespaces 转发仍需实机联调。
- 未实现短信、电话、推送、实体灯/LED、生产级多用户权限和医疗级照护能力。

GitHub 提交、CI 和 Pages 发布状态将以实际远程结果另行更新；不能把预期地址当上线证明。
