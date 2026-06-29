# 刷题 App

一个本地自用的 SwiftUI iOS 刷题 App。第一阶段先实现最小可运行版本：内置示例题、题库列表、答题判定、错题记录和错题复刷。

## 先用本地网站

如果你暂时不想折腾 Xcode，可以先运行网页版本：

```bash
cd /Users/yangyanxi/Documents/刷题
python3 -m http.server 8000
```

然后打开：

```text
http://localhost:8000/WebPracticeApp/
```

网页版本支持示例题库、json/csv/txt/docx/pdf 导入、刷题、随机刷题、错题本、收藏、清空记录和导出数据。数据保存在当前浏览器的 `localStorage`。

## 运行方式

1. 用 Xcode 打开 `QuestionPracticeApp.xcodeproj`。
2. 选择 `QuestionPracticeApp` target。
3. 在 `Signing & Capabilities` 中选择你自己的 Apple ID Team。
4. 选择 iPhone 模拟器或已连接的 iPhone。
5. 点击 Run。

如果要安装到真机，请确保 iPhone 已信任当前 Mac，并且 Bundle Identifier 在你的账号下唯一。必要时可把 `com.local.QuestionPracticeApp` 改成类似 `com.yourname.QuestionPracticeApp`。

## 当前功能

- 首页展示本地题库。
- 每个题库显示题目数、已刷数、错题数。
- 可以进入题库顺序刷题。
- 支持单选题选择、提交、显示对错、正确答案和解析。
- 答错自动加入错题本。
- 错题页展示错题列表，并支持错题复刷。
- 每题记录答题次数、错误次数、连续答对次数、最近答题时间。
- 答题记录使用 `UserDefaults + Codable` 本地保存。

## 题库导入

首页点击左上角导入按钮，可以选择题库文件。

- `json`：优先推荐，字段结构稳定。
- `csv`：适合从表格导出，表头必须是 `question,A,B,C,D,answer,explanation,type,source`。
- `txt`：按固定模板解析，每题从 `题目：` 开始。
- `docx`：网页版本已内置 `JSZip`，会读取 Word 文档里的纯文本并按 txt 模板解析；仅支持 `.docx`，不支持旧版 `.doc` 和图片题。
- `pdf`：网页版本已内置 `PDF.js`，会读取可复制文字；支持类似 `1. 题干 A.选项...` 的编号选择题，尝试识别选项字母下方短横线作为正确答案，并按章节拆分题库。扫描版 PDF 和图片题暂不支持。

详细模板见 `QuestionBankTemplates.md`。
