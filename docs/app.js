import { GestureGate, reduceState } from "./core.js";
const $ = (id) => document.getElementById(id);
const config = await (await fetch("./config.json")).json();
const gate = new GestureGate(config);
let state = { alert: false, light: false },
  stream = null,
  model = null,
  running = false,
  generation = 0;
let api = "",
  bearer = "",
  polling = null,
  lastVideoTime = -1,
  lastFresh = 0,
  lastRevision = -1,
  session = 0,
  backendMode = "browser";
function log(message) {
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString()} ${message}`;
  $("events").prepend(li);
  while ($("events").children.length > 100) $("events").lastChild.remove();
}
function render() {
  $("alarm").textContent = state.alert ? "● 报警中" : "● 无报警";
  $("alarm").classList.toggle("alert", state.alert);
  $("lamp").classList.toggle("on", state.light);
  $("lampText").textContent = `虚拟灯 · ${state.light ? "已开启" : "已关闭"}`;
}
function metrics(name = "—", score = 0) {
  $("gesture").textContent = name;
  $("score").textContent = score.toFixed(3);
  $("frames").textContent = gate.frames;
  $("progress").value = gate.progress;
  $("holdStatus").textContent = gate.locked
    ? "已触发，请放下手至少 0.4 秒"
    : `保持进度 ${Math.round(gate.progress * 100)}%`;
}
function reset() {
  gate.reset();
  metrics();
}
function acceptState(next) {
  if (next.revision >= lastRevision) {
    lastRevision = next.revision;
    state = next;
    render();
  }
}
async function request(path, options = {}) {
  const r = await fetch(api + path, {
    ...options,
    signal: AbortSignal.timeout(5000),
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) throw Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function dispatch(action) {
  const event = { id: crypto.randomUUID(), action, source: "browser" };
  if (!api) {
    state = reduceState(state, action);
    render();
    log(`[AI / 本地] ${action} ${event.id}`);
    return;
  } // Never auto-replay an old cancellation after an outage.
  const ticket = session;
  try {
    const result = await request("/api/events", {
      method: "POST",
      body: JSON.stringify(event),
    });
    if (ticket !== session) return;
    acceptState(result.state);
    log(`[AI / 后端确认] ${action} ${event.id}`);
  } catch (e) {
    if (ticket !== session) return;
    log(
      `[发送失败 / 结果未知，先查询状态] ${action} ${event.id}: ${e.message}`,
    );
    $("connection").textContent =
      "提交失败；不自动重放，请刷新状态后重新手势操作";
  }
}
async function loadModel() {
  if (model) return;
  const { FilesetResolver, GestureRecognizer } = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs"
  );
  const files = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm",
  );
  model = await GestureRecognizer.createFromOptions(files, {
    baseOptions: { modelAssetPath: "./models/gesture_recognizer.task" },
    runningMode: "VIDEO",
    numHands: 1,
  });
}
async function cameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const selected = $("cameraSelect").value;
    $("cameraSelect").replaceChildren(new Option("默认摄像头", ""));
    for (const d of devices.filter((x) => x.kind === "videoinput"))
      $("cameraSelect").add(
        new Option(d.label || `摄像头 ${$("cameraSelect").length}`, d.deviceId),
      );
    $("cameraSelect").value = selected;
  } catch {}
}
function stop(reason = "摄像头已停止") {
  generation++;
  running = false;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  $("video").srcObject = null;
  reset();
  $("canvas")
    .getContext("2d")
    .clearRect(0, 0, $("canvas").width, $("canvas").height);
  $("placeholder").hidden = false;
  $("cameraStatus").textContent = reason;
  $("start").disabled = backendMode === "pc";
}
function draw(result) {
  const c = $("canvas"),
    v = $("video");
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  for (const hand of result.landmarks) {
    ctx.strokeStyle = "#b8ed79";
    ctx.lineWidth = 3;
    for (const chain of [
      [0, 1, 2, 3, 4],
      [0, 5, 6, 7, 8],
      [5, 9, 10, 11, 12],
      [9, 13, 14, 15, 16],
      [13, 17, 18, 19, 20],
      [0, 17],
    ]) {
      ctx.beginPath();
      chain.forEach((i, j) =>
        j
          ? ctx.lineTo(hand[i].x * c.width, hand[i].y * c.height)
          : ctx.moveTo(hand[i].x * c.width, hand[i].y * c.height),
      );
      ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    for (const p of hand) {
      ctx.beginPath();
      ctx.arc(p.x * c.width, p.y * c.height, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}
function frame() {
  if (!running) return;
  const v = $("video"),
    now = performance.now();
  try {
    if (v.readyState >= 2 && v.currentTime !== lastVideoTime) {
      lastVideoTime = v.currentTime;
      lastFresh = now;
      const result = model.recognizeForVideo(v, now);
      draw(result);
      const item = result.gestures[0]?.[0];
      const action = gate.update(
        item?.categoryName || "",
        item?.score || 0,
        now,
      );
      metrics(item?.categoryName || "无有效手势", item?.score || 0);
      if (action) void dispatch(action);
    } else if (now - lastFresh > config.maxGapMs) {
      reset();
      $("cameraStatus").textContent = "视频中断，计时已重置";
    }
  } catch (e) {
    $("error").textContent = `识别失败：${e.message}`;
    stop("识别异常，已停止");
    return;
  }
  requestAnimationFrame(frame);
}
$("start").onclick = async () => {
  stop();
  $("start").disabled = true;
  $("error").textContent = "";
  const ticket = generation;
  let acquired = null;
  try {
    if (!navigator.mediaDevices?.getUserMedia)
      throw Error("当前环境不支持摄像头，请通过 HTTPS 或 localhost 打开");
    $("cameraStatus").textContent = "请求摄像头权限…";
    acquired = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: $("cameraSelect").value
        ? { deviceId: { exact: $("cameraSelect").value } }
        : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    });
    if (ticket !== generation) {
      acquired.getTracks().forEach((t) => t.stop());
      return;
    }
    stream = acquired;
    stream.getVideoTracks()[0].onended = () => stop("摄像头已断开");
    stream.getVideoTracks()[0].onmute = () => {
      reset();
      $("cameraStatus").textContent = "摄像头暂停";
    };
    $("cameraStatus").textContent = "加载 MediaPipe 与模型…";
    await loadModel();
    if (ticket !== generation) return;
    $("video").srcObject = stream;
    await $("video").play();
    if (ticket !== generation) return;
    running = true;
    reset();
    lastVideoTime = -1;
    lastFresh = performance.now();
    $("placeholder").hidden = true;
    $("cameraStatus").textContent = "实时 AI 识别中";
    await cameras();
    frame();
  } catch (e) {
    acquired?.getTracks().forEach((t) => t.stop());
    if (ticket !== generation) return;
    stop("摄像头不可用");
    $("error").textContent =
      `摄像头或模型启动失败：${e.name}: ${e.message}。请检查摄像头权限、设备占用、模型文件和网络。`;
    log("[错误] " + $("error").textContent);
  }
};
$("stop").onclick = () => stop();
$("cameraSelect").onchange = () => stop("已更换设备，请重新启动");
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop("页面进入后台，摄像头已停止");
});
window.addEventListener("pagehide", () => stop());
$("threshold").onchange = () => {
  const n = Number($("threshold").value);
  if (!$("threshold").value || !Number.isFinite(n) || n < 0 || n > 1) {
    $("threshold").value = config.threshold;
    return;
  }
  config.threshold = n;
  reset();
  log(`阈值已设为 ${n}，计时重置`);
};
function disconnect() {
  session++;
  clearInterval(polling);
  polling = null;
  api = "";
  bearer = "";
  backendMode = "browser";
  lastRevision = -1;
  state = { alert: false, light: false };
  render();
  $("modeBadge").textContent = "设备端 AI · 本地演示";
  $("stateOrigin").textContent = "本地演示";
  $("connection").textContent = "未连接后端";
  $("start").disabled = running;
  document
    .querySelectorAll("[data-action]")
    .forEach((b) => (b.disabled = false));
  reset();
}
$("disconnect").onclick = disconnect;
$("connect").onclick = async () => {
  stop("连接后端，请稍候");
  disconnect();
  const ticket = session;
  $("start").disabled = true;
  document
    .querySelectorAll("[data-action]")
    .forEach((b) => (b.disabled = true));
  try {
    const url = new URL($("backendUrl").value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw Error("仅允许无查询参数的 HTTP(S) 后端地址");
    api = url.href.replace(/\/$/, "");
    bearer = $("token").value;
    const health = await request("/api/health");
    if (ticket !== session) return;
    const next = await request("/api/state");
    if (ticket !== session) return;
    backendMode = health.input_mode;
    acceptState(next);
    $("connection").textContent = `已连接 · 输入入口 ${health.input_mode}`;
    $("modeBadge").textContent = "共享后端状态";
    $("stateOrigin").textContent = "服务器确认";
    if (health.input_mode === "pc")
      stop("后端使用 PC 输入；请勿启动浏览器识别");
    $("start").disabled = health.input_mode === "pc";
    polling = setInterval(async () => {
      try {
        const next = await request("/api/state");
        if (ticket !== session) return;
        acceptState(next);
        $("connection").textContent = "已连接 · 状态同步正常";
      } catch (e) {
        if (ticket === session)
          $("connection").textContent =
            "状态同步失败，显示的可能是旧状态：" + e.message;
      }
    }, 1000);
  } catch (e) {
    if (ticket !== session) return;
    disconnect();
    $("connection").textContent = "连接失败：" + e.message;
  }
};
document.querySelectorAll("[data-action]").forEach(
  (b) =>
    (b.onclick = () => {
      if (api) return;
      state = reduceState(state, b.dataset.action);
      render();
      log(`[模拟操作 / 非 AI / 仅本地] ${b.dataset.action}`);
    }),
);
render();
if (navigator.mediaDevices) void cameras();
