// 放入 React Native + Expo 项目。组件卸载时停止轮询；令牌由登录/安全配置传入。
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
type CareState = {
  alert: boolean;
  light: boolean;
  revision: number;
  input_mode: string;
};
export default function CareStatus({
  baseUrl,
  token,
}: {
  baseUrl: string;
  token: string;
}) {
  const [state, setState] = useState<CareState | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(
          baseUrl.replace(/\/$/, "") + "/api/state",
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = await response.json();
        if (active) {
          setState(next);
          setError("");
        }
      } catch (e) {
        if (active) setError(String(e));
      }
      if (active) timer = setTimeout(poll, 1000);
    }
    let timer: ReturnType<typeof setTimeout>;
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [baseUrl, token]);
  return (
    <View>
      <Text>{error ? `连接异常（可能显示旧状态）：${error}` : "状态同步"}</Text>
      <Text>
        报警：{state ? (state.alert ? "报警中" : "无报警") : "等待连接"}
      </Text>
      <Text>虚拟灯：{state?.light ? "开启" : "关闭"}</Text>
    </View>
  );
}
