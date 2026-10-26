# 原始上传保留

`initial-upload/` 完整保留远程 main 提交 `87eafc7d9f069cfbcddffbf6c59ee27637995c39` 的顶层文件。该提交实际只含文档、CSV、package.json 和启动脚本，未上传文档提到的前端/后端/测试代码。原说明中的验证记录是历史材料，本次没有其对应源码，不能作为本次实现的验证证据。

现行实现与启动方法见根目录 README。原方案的四手势约定、400ms 释放要求、团队接口目标和中文实验计划已延续；本次补齐可运行代码、PC 入口、持久化去重与测试。旧接口文档中的 `alarm`、`fall_detection`、`gesture` 与 `CARE_API_TOKEN` 已改为当前统一协议 `alert`、`fall`、`browser|pc` 与 `CARE_TOKEN`，队友请按 `guides/API.md` 调用。旧文件仅供追溯，不作为运行入口。
