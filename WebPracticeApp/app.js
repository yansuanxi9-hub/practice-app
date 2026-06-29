const STORAGE_KEY = "local-practice-web-v1";
const BUILTIN_DATA_URL = "./data/modern-history-2026.json?v=20260628-rapid";
const letters = ["A", "B", "C", "D"];
let wrongFilter = "all";

if (new URLSearchParams(location.search).get("resetData") === "1") {
  localStorage.removeItem(STORAGE_KEY);
  history.replaceState(null, "", location.pathname);
}

const sampleBanks = [
  {
    id: "bank-swiftui",
    name: "SwiftUI 入门示例",
    description: "用于验证刷题流程",
    questions: [
      {
        id: "q-swiftui-1",
        question: "SwiftUI 中用于声明 App 入口的标记是什么？",
        options: {
          A: "@main",
          B: "@State",
          C: "@Binding",
          D: "@Environment"
        },
        answer: "A",
        explanation: "@main 标记程序入口类型。@State、@Binding 和 @Environment 用于管理视图状态或环境值。",
        type: "single",
        source: "SwiftUI 入门示例"
      },
      {
        id: "q-swiftui-2",
        question: "下面哪一个更适合在多个页面共享刷题状态？",
        options: {
          A: "局部 let 常量",
          B: "ObservableObject",
          C: "普通 String",
          D: "Button 内临时变量"
        },
        answer: "B",
        explanation: "跨页面共享且会变化的数据适合放进 ObservableObject，并通过环境或依赖注入传递。",
        type: "single",
        source: "SwiftUI 入门示例"
      }
    ]
  },
  {
    id: "bank-general",
    name: "通用常识示例",
    description: "少量单选题，方便测试错题本",
    questions: [
      {
        id: "q-general-1",
        question: "中国标准时间所在时区是？",
        options: {
          A: "UTC+6",
          B: "UTC+7",
          C: "UTC+8",
          D: "UTC+9"
        },
        answer: "C",
        explanation: "中国标准时间为 UTC+8。",
        type: "single",
        source: "通用常识示例"
      },
      {
        id: "q-general-2",
        question: "CSV 文件通常表示什么类型的数据？",
        options: {
          A: "逗号分隔的表格数据",
          B: "压缩图片",
          C: "视频流",
          D: "可执行程序"
        },
        answer: "A",
        explanation: "CSV 是 Comma-Separated Values，常用于保存表格型文本数据。",
        type: "single",
        source: "通用常识示例"
      }
    ]
  }
];

let state = loadState();
let practiceSession = {
  bankId: null,
  collectionId: null,
  title: "",
  questionIds: [],
  index: 0,
  selected: null,
  submitted: false,
  mode: "order"
};

const els = {
  importButton: document.querySelector("#importButton"),
  fileInput: document.querySelector("#fileInput"),
  bankList: document.querySelector("#bankList"),
  unitList: document.querySelector("#unitList"),
  collectionTitle: document.querySelector("#collectionTitle"),
  collectionOverview: document.querySelector("#collectionOverview"),
  backToCollections: document.querySelector("#backToCollections"),
  startCollectionRandom: document.querySelector("#startCollectionRandom"),
  wrongOverview: document.querySelector("#wrongOverview"),
  wrongList: document.querySelector("#wrongList"),
  submitButton: document.querySelector("#submitButton"),
  previousButton: document.querySelector("#previousButton"),
  optionList: document.querySelector("#optionList"),
  questionStem: document.querySelector("#questionStem"),
  practiceSource: document.querySelector("#practiceSource"),
  progressText: document.querySelector("#progressText"),
  answerPanel: document.querySelector("#answerPanel"),
  practiceLayout: document.querySelector(".practice-layout"),
  answerResult: document.querySelector("#answerResult"),
  correctAnswer: document.querySelector("#correctAnswer"),
  explanation: document.querySelector("#explanation"),
  favoriteButton: document.querySelector("#favoriteButton"),
  removeWrongButton: document.querySelector("#removeWrongButton"),
  backToBanks: document.querySelector("#backToBanks"),
  toast: document.querySelector("#toast"),
  exportButton: document.querySelector("#exportButton"),
  resetProgressButton: document.querySelector("#resetProgressButton"),
  clearAllButton: document.querySelector("#clearAllButton")
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return { banks: [], collections: [], stats: {} };
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      banks: Array.isArray(parsed.banks) ? parsed.banks : structuredClone(sampleBanks),
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
      stats: parsed.stats && typeof parsed.stats === "object" ? parsed.stats : {}
    };
  } catch {
    return { banks: [], collections: [], stats: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function ensureBuiltinModernHistory() {
  const hasData = (state.collections && state.collections.length > 0) || state.banks.length > 0;
  if (hasData) return;

  try {
    const response = await fetch(BUILTIN_DATA_URL);
    if (!response.ok) throw new Error("基础题库加载失败");
    const data = await response.json();
    state.collections = [data.collection];
    state.banks = data.banks;
    state.stats = {};
    saveState();
    render();
  } catch (error) {
    showToast("基础题库加载失败，请手动导入 PDF。");
  }
}

function getAllQuestions() {
  return state.banks.flatMap((bank) => bank.questions.map((question) => ({ ...question, bankId: bank.id, bankName: bank.name })));
}

function getQuestion(id) {
  return getAllQuestions().find((question) => question.id === id);
}

function getStats(questionId) {
  if (!state.stats[questionId]) {
    state.stats[questionId] = {
      attempts: 0,
      wrongAttempts: 0,
      consecutiveCorrect: 0,
      isWrong: false,
      isFavorite: false,
      lastAnsweredAt: null
    };
  }
  return state.stats[questionId];
}

function render() {
  renderBanks();
  renderUnits();
  renderWrong();
  if (document.querySelector("#practiceView").classList.contains("active-view")) {
    renderPractice();
  }
}

function renderBanks() {
  const standaloneBanks = state.banks.filter((bank) => !bank.collectionId);
  const collections = state.collections || [];
  els.bankList.innerHTML = "";

  collections.forEach((collection) => {
    const units = state.banks.filter((bank) => bank.collectionId === collection.id);
    const allQuestions = units.flatMap((bank) => bank.questions);
    const practiced = allQuestions.filter((question) => getStats(question.id).attempts > 0).length;
    const wrong = allQuestions.filter((question) => getStats(question.id).isWrong).length;
    const progress = allQuestions.length ? Math.round((practiced / allQuestions.length) * 100) : 0;

    const row = document.createElement("article");
    row.className = "bank-row collection-row";
    row.innerHTML = `
      <div class="bank-row-header">
        <div>
          <h3>${escapeHTML(collection.name)}</h3>
          <p>${allQuestions.length} 道题 · ${units.length} 个单元</p>
        </div>
        <button class="chevron-button" data-open-collection="${collection.id}" onclick="openCollection(this.dataset.openCollection)" aria-label="选择单元">›</button>
      </div>
      <p class="bank-meta">已刷 ${practiced} · 错题 <span class="danger-text">${wrong}</span> · 收藏 ${allQuestions.filter((question) => getStats(question.id).isFavorite).length}</p>
      <div class="progress-line" aria-label="刷题进度">
        <span style="width: ${progress}%"></span>
      </div>
      <div class="row-actions">
        <button class="primary-button" data-collection-random="${collection.id}" onclick="startCollectionPractice(this.dataset.collectionRandom, 'random')">随机刷合集</button>
        <button class="danger-button" data-delete-collection="${collection.id}" onclick="deleteCollection(this.dataset.deleteCollection)">删除合集</button>
      </div>
    `;
    els.bankList.append(row);
  });

  standaloneBanks.forEach((bank) => {
    const total = bank.questions.length;
    const practiced = bank.questions.filter((question) => getStats(question.id).attempts > 0).length;
    const wrong = bank.questions.filter((question) => getStats(question.id).isWrong).length;
    const progress = total ? Math.round((practiced / total) * 100) : 0;

    const row = document.createElement("article");
    row.className = "bank-row";
    row.innerHTML = `
      <div class="bank-row-header">
        <div>
          <h3>${escapeHTML(bank.name)}</h3>
          <p>${total} 道题</p>
        </div>
        <button class="chevron-button" data-start="${bank.id}" onclick="startBankPractice(this.dataset.start, 'order')" aria-label="开始刷题">›</button>
      </div>
      <p class="bank-meta">已刷 ${practiced} · 错题 <span class="danger-text">${wrong}</span> · 收藏 ${bank.questions.filter((question) => getStats(question.id).isFavorite).length}</p>
      <div class="progress-line" aria-label="刷题进度">
        <span style="width: ${progress}%"></span>
      </div>
      <div class="row-actions">
        <button class="primary-button" data-start="${bank.id}" onclick="startBankPractice(this.dataset.start, 'order')">开始刷题</button>
        <button class="ghost-button" data-random="${bank.id}" onclick="startBankPractice(this.dataset.random, 'random')">随机刷题</button>
        <button class="danger-button" data-delete="${bank.id}" onclick="deleteBank(this.dataset.delete)">删除题库</button>
      </div>
    `;
    els.bankList.append(row);
  });

}

function renderUnits() {
  const collection = getCurrentCollection();
  if (!collection) return;

  const units = state.banks.filter((bank) => bank.collectionId === collection.id);
  const total = units.reduce((sum, bank) => sum + bank.questions.length, 0);
  els.collectionTitle.textContent = collection.name;
  els.collectionOverview.textContent = `${units.length} 个单元 · ${total} 道题`;
  els.unitList.innerHTML = "";

  units.forEach((bank) => {
    const summary = summarizeBank(bank);
    const unitNumber = String(units.indexOf(bank) + 1).padStart(2, "0");
    const row = document.createElement("article");
    row.className = "bank-row unit-row";
    row.innerHTML = `
      <div class="unit-index">${unitNumber}</div>
      <div class="bank-row-header">
        <div>
          <h3>${escapeHTML(bank.name)}</h3>
          <p>${summary.total} 道题 · 已刷 ${summary.practiced} · 错题 <span class="danger-text">${summary.wrong}</span></p>
        </div>
        <button class="chevron-button" data-start="${bank.id}" onclick="startBankPractice(this.dataset.start, 'order')" aria-label="开始刷题">›</button>
      </div>
    `;
    els.unitList.append(row);
  });

}

function summarizeBank(bank) {
  return {
    total: bank.questions.length,
    practiced: bank.questions.filter((question) => getStats(question.id).attempts > 0).length,
    wrong: bank.questions.filter((question) => getStats(question.id).isWrong).length
  };
}

function getCurrentCollection() {
  return (state.collections || []).find((collection) => collection.id === practiceSession.collectionId);
}

function renderWrong() {
  const allWrongQuestions = getAllQuestions().filter((question) => getStats(question.id).isWrong);
  const wrongQuestions = allWrongQuestions.filter((question) => {
    const stats = getStats(question.id);
    if (wrongFilter === "mastered") return stats.consecutiveCorrect >= 2;
    if (wrongFilter === "unmastered") return stats.consecutiveCorrect < 2;
    return true;
  });
  els.wrongOverview.textContent = `共 ${allWrongQuestions.length} 题`;
  els.wrongList.innerHTML = "";
  document.querySelectorAll("[data-wrong-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.wrongFilter === wrongFilter);
  });

  if (wrongQuestions.length === 0) {
    els.wrongList.innerHTML = `<article class="question-row empty-row"><h3>暂无错题</h3><p>答错的题会自动出现在这里。</p></article>`;
    return;
  }

  wrongQuestions.forEach((question) => {
    const stats = getStats(question.id);
    const row = document.createElement("article");
    row.className = "question-row";
    row.innerHTML = `
      <div>
        <h3>${escapeHTML(question.question)}</h3>
        <p>${escapeHTML(question.bankName)}</p>
      </div>
      <p class="wrong-meta">答错 ${stats.wrongAttempts} 次</p>
      <button class="ghost-button" onclick="startQuestionPractice('${question.id}')">重新练习</button>
    `;
    els.wrongList.append(row);
  });
}

function renderPractice() {
  const question = getQuestion(practiceSession.questionIds[practiceSession.index]);
  if (!question) {
    showView("banks");
    return;
  }

  const stats = getStats(question.id);
  els.practiceSource.textContent = question.bankName || question.source || "题库";
  els.questionStem.textContent = question.question;
  els.progressText.textContent = `${practiceSession.index + 1}/${practiceSession.questionIds.length}`;
  els.favoriteButton.textContent = stats.isFavorite ? "★" : "☆";
  els.optionList.innerHTML = "";

  letters.forEach((letter) => {
    const button = document.createElement("button");
    button.className = "option-button";
    if (practiceSession.selected === letter) button.classList.add("selected");
    if (practiceSession.submitted && question.answer !== "UNKNOWN" && question.answer === letter) button.classList.add("correct");
    if (practiceSession.submitted && question.answer !== "UNKNOWN" && practiceSession.selected === letter && question.answer !== letter) button.classList.add("wrong");
    button.disabled = practiceSession.submitted;
    button.innerHTML = `<span class="option-letter">${letter}</span><span>${escapeHTML(question.options[letter])}</span>`;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!practiceSession.submitted) {
        chooseAnswer(letter);
      }
    });
    els.optionList.append(button);
  });

  if (practiceSession.submitted) {
    const hasKnownAnswer = question.answer !== "UNKNOWN";
    const isCorrect = hasKnownAnswer && practiceSession.selected === question.answer;
    els.answerPanel.classList.add("hidden");
    els.answerResult.textContent = hasKnownAnswer ? (isCorrect ? "回答正确" : "回答错误") : "已记录";
    els.answerResult.style.color = hasKnownAnswer ? (isCorrect ? "var(--good)" : "var(--bad)") : "var(--warn)";
    els.correctAnswer.textContent = hasKnownAnswer ? `正确答案：${question.answer}` : "正确答案：未识别";
    els.explanation.textContent = question.explanation || "暂无解析";
    els.submitButton.textContent = practiceSession.index === practiceSession.questionIds.length - 1 ? "重新开始" : "下一题";
    els.submitButton.disabled = false;
    els.submitButton.classList.remove("hidden");
    els.removeWrongButton.classList.toggle("hidden", !(stats.isWrong && stats.consecutiveCorrect >= 2));
  } else {
    els.answerPanel.classList.add("hidden");
    els.submitButton.textContent = "下一题";
    els.submitButton.disabled = false;
    els.submitButton.classList.remove("hidden");
    els.removeWrongButton.classList.add("hidden");
  }

  document.querySelectorAll(".segmented").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === practiceSession.mode);
  });
}

function startBankPractice(bankId, mode) {
  const bank = state.banks.find((item) => item.id === bankId);
  if (!bank || bank.questions.length === 0) return;
  const questionIds = bank.questions.map((question) => question.id);
  startPractice(bank.name, mode === "random" ? shuffle(questionIds) : questionIds, mode);
}

function openCollection(collectionId) {
  practiceSession.collectionId = collectionId;
  showView("units");
}

function startCollectionPractice(collectionId, mode) {
  const collection = (state.collections || []).find((item) => item.id === collectionId);
  const units = state.banks.filter((bank) => bank.collectionId === collectionId);
  const questionIds = units.flatMap((bank) => bank.questions.map((question) => question.id));
  if (questionIds.length === 0) return;
  startPractice(collection?.name || "合集刷题", mode === "random" ? shuffle(questionIds) : questionIds, mode);
}

function startQuestionPractice(questionId) {
  const question = getQuestion(questionId);
  if (!question) return;
  startPractice(question.bankName || "错题复刷", [questionId], "order");
}

function startPractice(title, questionIds, mode) {
  practiceSession = {
    bankId: null,
    collectionId: practiceSession.collectionId,
    title,
    questionIds,
    index: 0,
    selected: null,
    submitted: false,
    mode
  };
  showView("practice");
  renderPractice();
}

function chooseAnswer(letter) {
  practiceSession.selected = letter;
  recordCurrentAnswer();
}

function recordCurrentAnswer() {
  const question = getQuestion(practiceSession.questionIds[practiceSession.index]);
  if (!question) return;

  if (!practiceSession.submitted) {
    const stats = getStats(question.id);
    const hasKnownAnswer = question.answer !== "UNKNOWN";
    const isCorrect = hasKnownAnswer && practiceSession.selected === question.answer;
    stats.attempts += 1;
    stats.lastAnsweredAt = new Date().toISOString();
    if (!hasKnownAnswer) {
      stats.consecutiveCorrect = 0;
    } else if (isCorrect) {
      stats.consecutiveCorrect += 1;
    } else {
      stats.wrongAttempts += 1;
      stats.consecutiveCorrect = 0;
      stats.isWrong = true;
    }
    practiceSession.submitted = true;
    saveState();
    render();
    return;
  }
}

function nextQuestion() {
  if (practiceSession.index < practiceSession.questionIds.length - 1) {
    practiceSession.index += 1;
  } else {
    practiceSession.index = 0;
  }
  practiceSession.selected = null;
  practiceSession.submitted = false;
  renderPractice();
}

function previousQuestion() {
  if (practiceSession.index > 0) {
    practiceSession.index -= 1;
  } else {
    practiceSession.index = Math.max(practiceSession.questionIds.length - 1, 0);
  }
  practiceSession.selected = null;
  practiceSession.submitted = false;
  renderPractice();
}

function submitOrNext() {
  nextQuestion();
}

async function handleFile(file) {
  try {
    const ext = file.name.split(".").pop().toLowerCase();
    let questions;
    if (ext === "json") questions = parseJSONQuestions(await file.text());
    else if (ext === "csv") questions = parseCSVQuestions(await file.text());
    else if (ext === "txt") questions = parseTXTQuestions(await file.text());
    else if (ext === "docx") questions = parseTXTQuestions(await extractDOCXText(file));
    else if (ext === "pdf") questions = await extractPDFQuestions(file);
    else throw new Error("暂不支持该文件类型，请导入 json、csv、txt、docx 或 pdf。");

    const imported = makeBanksFromImportedQuestions(questions, file.name, ext === "pdf");
    if (imported.collection) {
      state.collections = state.collections || [];
      state.collections.push(imported.collection);
    }
    state.banks.push(...imported.banks);
    saveState();
    render();
    const total = imported.banks.reduce((sum, bank) => sum + bank.questions.length, 0);
    showToast(imported.collection ? `已导入「${imported.collection.name}」，${imported.banks.length} 个单元，共 ${total} 道题。` : `已导入 ${imported.banks.length} 个题库，共 ${total} 道题。`);
  } catch (error) {
    showToast(error.message || "导入失败，请检查文件格式。");
  } finally {
    els.fileInput.value = "";
  }
}

function makeBanksFromImportedQuestions(questions, fileName, shouldSplitBySource = false) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("没有解析到题目。");
  }

  const fallbackName = fileName.replace(/\.[^.]+$/, "");
  const firstSource = questions.find((question) => question.source)?.source || fallbackName;
  const groups = new Map();

  questions.forEach((question) => {
    const source = shouldSplitBySource ? (question.source || fallbackName) : firstSource;
    if (!groups.has(source)) {
      groups.set(source, []);
    }
    groups.get(source).push(question);
  });

  const collection = shouldSplitBySource ? {
    id: crypto.randomUUID(),
    name: `${fallbackName} 合集`,
    description: `${groups.size} 个单元，来自 ${fileName}`
  } : null;

  const banks = [...groups.entries()].map(([source, groupQuestions]) => ({
    id: crypto.randomUUID(),
    collectionId: collection?.id,
    name: source,
    description: `${groupQuestions.length} 道题，来自 ${fileName}`,
    questions: groupQuestions.map((question) => ({ ...question, id: crypto.randomUUID() }))
  }));

  return { collection, banks };
}

async function extractDOCXText(file) {
  const ZipReader = typeof window !== "undefined" ? window.PracticeZipReader : null;
  if (!ZipReader) {
    throw new Error("DOCX 解析组件未加载，请刷新页面后再试。");
  }

  let zip;
  try {
    zip = await ZipReader.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error("DOCX 文件无法打开。请确认它是 .docx，不是旧版 .doc。");
  }

  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new Error("DOCX 中没有找到 word/document.xml，请确认文件是标准 Word 文档。");
  }

  const xml = await documentFile.async("text");
  const text = docxXMLToPlainText(xml);
  if (!text.trim()) {
    throw new Error("没有从 DOCX 中提取到文字内容。图片题暂不支持。");
  }

  return text;
}

function docxXMLToPlainText(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("DOCX 内部 XML 解析失败。");
  }

  const paragraphs = [...doc.getElementsByTagName("w:p")];
  if (paragraphs.length === 0) {
    return xmlToText(xml);
  }

  return paragraphs
    .map((paragraph) => {
      const textNodes = [...paragraph.getElementsByTagName("w:t")];
      return textNodes.map((node) => node.textContent || "").join("");
    })
    .join("\n");
}

function xmlToText(xml) {
  const withBreaks = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<[^>]+>/g, "");
  const textarea = document.createElement("textarea");
  textarea.innerHTML = withBreaks;
  return textarea.value;
}

async function extractPDFText(file) {
  const PDFReader = typeof window !== "undefined" ? window.PracticePDFReader : null;
  if (!PDFReader) {
    throw new Error("PDF 解析组件未加载，请刷新页面后再试。");
  }

  let pdf;
  try {
    pdf = await PDFReader.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch {
    throw new Error("PDF 文件无法打开。请确认它不是加密 PDF。");
  }

  const pageTexts = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(pdfItemsToText(content.items));
  }

  const text = repairExtractedPDFText(pageTexts.join("\n"));
  if (!text.trim()) {
    throw new Error("没有从 PDF 中提取到文字。扫描版或图片版 PDF 暂不支持。");
  }

  return text;
}

async function extractPDFQuestions(file) {
  const text = await extractPDFText(file);
  const questions = parseImportedText(text, "PDF", {
    source: file.name.replace(/\.[^.]+$/, ""),
    allowUnknownAnswer: true
  });
  const answers = await extractPDFUnderlinedAnswers(file);

  questions.forEach((question, index) => {
    if (answers[index]) {
      question.answer = answers[index];
      if (question.explanation === "PDF 未能识别原文中的下划线/斜体答案标记。") {
        question.explanation = "";
      }
    }
  });

  const knownAnswers = questions.filter((question) => question.answer !== "UNKNOWN").length;
  if (knownAnswers > 0 && knownAnswers < questions.length) {
    showToast(`已识别 ${knownAnswers}/${questions.length} 道题的答案。`);
  }

  return questions;
}

async function extractPDFUnderlinedAnswers(file) {
  const PDFReader = typeof window !== "undefined" ? window.PracticePDFReader : null;
  if (!PDFReader) {
    return [];
  }

  let pdf;
  try {
    pdf = await PDFReader.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch {
    return [];
  }

  const answers = [];
  const sectionState = { isSingleChoice: false };
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const underlines = await extractPageUnderlineSegments(page, PDFReader);
    answers.push(...matchUnderlinesToOptionLetters(content.items, underlines, sectionState));
  }

  return answers;
}

async function extractPageUnderlineSegments(page, PDFReader) {
  if (!page.getOperatorList || !PDFReader.OPS) {
    return [];
  }

  const opList = await page.getOperatorList();
  const OPS = PDFReader.OPS;
  const segments = [];
  let pendingSegments = [];
  let currentPoint = null;

  opList.fnArray.forEach((fn, index) => {
    const args = opList.argsArray[index];

    if (fn === OPS.constructPath && Array.isArray(args) && Array.isArray(args[0]) && Array.isArray(args[1])) {
      const pathOps = args[0];
      const coords = args[1];
      let coordIndex = 0;

      pathOps.forEach((pathOp) => {
        if (pathOp === OPS.moveTo) {
          currentPoint = { x: coords[coordIndex], y: coords[coordIndex + 1] };
          coordIndex += 2;
        } else if (pathOp === OPS.lineTo) {
          const nextPoint = { x: coords[coordIndex], y: coords[coordIndex + 1] };
          coordIndex += 2;

          if (currentPoint && Math.abs(currentPoint.y - nextPoint.y) < 1 && Math.abs(currentPoint.x - nextPoint.x) >= 4) {
            pendingSegments.push({
              x0: Math.min(currentPoint.x, nextPoint.x),
              x1: Math.max(currentPoint.x, nextPoint.x),
              y: currentPoint.y
            });
          }
          currentPoint = nextPoint;
        } else if (pathOp === OPS.rectangle) {
          const x = coords[coordIndex];
          const y = coords[coordIndex + 1];
          const width = coords[coordIndex + 2];
          const height = coords[coordIndex + 3];
          coordIndex += 4;

          if (Math.abs(height) < 1 && Math.abs(width) >= 4) {
            pendingSegments.push({ x0: Math.min(x, x + width), x1: Math.max(x, x + width), y });
          }
        }
      });
    } else if (fn === OPS.stroke) {
      segments.push(...pendingSegments);
      pendingSegments = [];
      currentPoint = null;
    } else if (fn === OPS.endPath) {
      pendingSegments = [];
      currentPoint = null;
    }
  });

  const pageHeight = Array.isArray(page.view) ? page.view[3] : 0;

  return segments
    .filter((segment) => segment.x1 - segment.x0 <= 24)
    .map((segment) => ({
      ...segment,
      y: pageHeight ? pageHeight - segment.y : segment.y
    }))
    .sort((a, b) => b.y - a.y || a.x0 - b.x0);
}

function matchUnderlinesToOptionLetters(items, underlines, sectionState = { isSingleChoice: true }) {
  const lineStates = buildSingleChoiceLineStates(items, sectionState);
  const markers = [];

  items.forEach((item) => {
    const text = item.str || "";
    const transform = item.transform || [];
    const x = transform[4] || 0;
    const y = transform[5] || 0;
    const lineKey = Math.round(y);
    const width = item.width || Math.max(text.length * 6, 1);

    if (!lineStates.get(lineKey)) {
      return;
    }

    if (/^[A-D]$/.test(text.trim())) {
      markers.push({ letter: text.trim(), x, y });
      return;
    }

    for (const match of text.matchAll(/([A-D])\s*[.．。]/g)) {
      const markerX = x + (match.index / Math.max(text.length, 1)) * width;
      markers.push({ letter: match[1], x: markerX, y });
    }
  });

  const matched = [];
  underlines.forEach((line) => {
    const marker = markers
      .filter((candidate) => {
        const overlapsX = line.x0 <= candidate.x + 12 && line.x1 >= candidate.x - 4;
        const nearY = Math.abs(line.y - candidate.y) <= 18;
        return overlapsX && nearY;
      })
      .sort((a, b) => {
        const aDistance = Math.abs(line.y - a.y) + Math.abs(line.x0 - a.x);
        const bDistance = Math.abs(line.y - b.y) + Math.abs(line.x0 - b.x);
        return aDistance - bDistance;
      })[0];

    if (marker) {
      matched.push(marker);
    }
  });

  return matched
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((marker) => marker.letter);
}

function buildSingleChoiceLineStates(items, sectionState) {
  const lineMap = new Map();

  items.forEach((item) => {
    const text = item.str || "";
    const transform = item.transform || [];
    const y = Math.round(transform[5] || 0);

    if (!lineMap.has(y)) {
      lineMap.set(y, []);
    }
    lineMap.get(y).push(text);
  });

  const lineStates = new Map();
  const lines = [...lineMap.entries()]
    .map(([y, parts]) => ({ y, text: parts.join(" ") }))
    .sort((a, b) => b.y - a.y);

  lines.forEach((line) => {
    if (/单项选择题|单选题/.test(line.text)) {
      sectionState.isSingleChoice = true;
    } else if (/多项选择题|多选题|判断题|简答题|论述题|材料|参考答案|答案要点|课后习题/.test(line.text)) {
      sectionState.isSingleChoice = false;
    }

    lineStates.set(line.y, sectionState.isSingleChoice);
  });

  return lineStates;
}

function pdfItemsToText(items) {
  let previousY = null;
  const lines = [];
  let currentLine = "";

  items.forEach((item) => {
    const value = item.str || "";
    if (!value.trim()) {
      return;
    }

    const y = Array.isArray(item.transform) ? Math.round(item.transform[5]) : previousY;
    if (previousY !== null && y !== null && Math.abs(y - previousY) > 2) {
      lines.push(currentLine.trim());
      currentLine = "";
    }

    currentLine += currentLine ? ` ${value}` : value;
    previousY = y;
  });

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.join("\n");
}

function repairExtractedPDFText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/([A-D])\s*[.．。]\s*/g, "$1. ")
    .replace(/([A-D])\s*[、]\s*/g, "$1. ")
    .replace(/([^\n\d])(\d{1,3})[.．、]\s*(?=[\u4e00-\u9fa5A-Za-z0-9“《])/g, "$1\n$2. ");
}

function parseJSONQuestions(text) {
  let rows;
  try {
    rows = JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON 解析失败：${error.message}`);
  }
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("JSON 必须是非空数组。");
  return rows.map((row, index) => normalizeQuestion({
    question: row.question,
    options: row.options || {},
    answer: row.answer,
    explanation: row.explanation,
    type: row.type,
    source: row.source
  }, index + 1, "JSON"));
}

function parseCSVQuestions(text) {
  const rows = parseCSVRows(text).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length < 2) throw new Error("CSV 至少需要表头和一行题目。");
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const required = ["question", "a", "b", "c", "d", "answer", "explanation", "type", "source"];
  required.forEach((name) => {
    if (!header.includes(name)) throw new Error(`CSV 缺少表头列：${name}`);
  });
  const indexOf = (name) => header.indexOf(name);
  return rows.slice(1).map((row, index) => normalizeQuestion({
    question: row[indexOf("question")],
    options: {
      A: row[indexOf("a")],
      B: row[indexOf("b")],
      C: row[indexOf("c")],
      D: row[indexOf("d")]
    },
    answer: row[indexOf("answer")],
    explanation: row[indexOf("explanation")],
    type: row[indexOf("type")],
    source: row[indexOf("source")]
  }, index + 2, "CSV"));
}

function parseTXTQuestions(text) {
  return parseImportedText(text, "TXT", { source: "导入题库", allowUnknownAnswer: false });
}

function parseImportedText(text, format, options = {}) {
  if (hasTemplateQuestions(text)) {
    return parseTemplateQuestions(text, format, options);
  }

  return parseNumberedChoiceQuestions(text, format, options);
}

function hasTemplateQuestions(text) {
  return /(^|\n)\s*题目[:：]/.test(text);
}

function parseTemplateQuestions(text, format = "TXT", options = {}) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n(?=\s*题目[:：])/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) throw new Error(`${format} 没有找到“题目：”开头的题目块。`);
  return blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const value = (...prefixes) => {
      const line = lines.find((item) => prefixes.some((prefix) => item.startsWith(prefix)));
      if (!line) return "";
      const prefix = prefixes.find((item) => line.startsWith(item));
      return line.slice(prefix.length).trim();
    };
    return normalizeQuestion({
      question: value("题目：", "题目:"),
      options: {
        A: value("A.", "A．", "A：", "A:"),
        B: value("B.", "B．", "B：", "B:"),
        C: value("C.", "C．", "C：", "C:"),
        D: value("D.", "D．", "D：", "D:")
      },
      answer: value("答案：", "答案:"),
      explanation: value("解析：", "解析:"),
      type: value("类型：", "题型：", "type:", "type："),
      source: value("来源：", "题库：") || options.source
    }, index + 1, format, options);
  });
}

function parseNumberedChoiceQuestions(text, format = "PDF", options = {}) {
  const normalized = repairExtractedPDFText(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[．。]/g, ".")
    .replace(/[，]/g, ",")
    .replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"));
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  let current = null;
  let isSingleChoiceSection = false;
  let currentChapter = options.source || "PDF 导入题库";

  lines.forEach((line) => {
    if (/^第.+章/.test(line)) {
      currentChapter = line;
      return;
    }

    if (/单项选择题|单选题/.test(line)) {
      isSingleChoiceSection = true;
      return;
    }

    if (/多项选择题|多选题|判断题|简答题|论述题|材料|参考答案|答案要点|课后习题/.test(line)) {
      if (current) blocks.push(current);
      current = null;
      isSingleChoiceSection = false;
      return;
    }

    if (!isSingleChoiceSection) {
      return;
    }

    const questionMatch = line.match(/^(\d{1,3})\s*[.、]\s*(.+)/);
    if (questionMatch) {
      if (current) blocks.push(current);
      current = {
        rowNumber: Number(questionMatch[1]),
        source: currentChapter,
        lines: [questionMatch[2]]
      };
      return;
    }

    if (current) {
      current.lines.push(line);
    }
  });

  if (current) blocks.push(current);

  if (blocks.length === 0) {
    throw new Error(`${format} 没有找到可解析的单项选择题。请确认题目类似“1. 题干 A.选项 B.选项”。`);
  }

  const parsed = [];
  const skipped = [];

  blocks.forEach((block, index) => {
    try {
      parsed.push(parseNumberedChoiceBlock(block, index + 1, format, options));
    } catch (error) {
      skipped.push(block.rowNumber || index + 1);
    }
  });

  if (parsed.length === 0) {
    throw new Error(`${format} 找到了题号，但没有题目能完整解析出 A/B/C/D。`);
  }

  if (skipped.length > 0) {
    showToast(`已跳过 ${skipped.length} 道格式异常题：${skipped.slice(0, 8).join("、")}`);
  }

  return parsed;
}

function parseNumberedChoiceBlock(block, fallbackRowNumber, format, options) {
  const compact = repairExtractedPDFText(block.lines.join("\n"))
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/([A-D])\s*[.、。．,，]\s*/g, " $1. ")
    .trim();
  const optionMatches = [...compact.matchAll(/(?:^|\s)([A-D])(?:\s*[.、。．,，]\s*|\s+(?=\S))/g)].slice(0, 4);

  if (optionMatches.length < 4) {
    throw new Error(`${format} 第 ${block.rowNumber || fallbackRowNumber} 题选项不足 4 个。`);
  }

  const firstOptionIndex = optionMatches[0].index;
  const stem = compact.slice(0, firstOptionIndex).trim();
  const optionValues = {};

  optionMatches.forEach((match, index) => {
    const letter = match[1];
    const valueStart = match.index + match[0].length;
    const valueEnd = index + 1 < optionMatches.length ? optionMatches[index + 1].index : compact.length;
    optionValues[letter] = compact.slice(valueStart, valueEnd).trim();
  });

  return normalizeQuestion({
    question: stem,
    options: optionValues,
    answer: "",
    explanation: "PDF 未能识别原文中的下划线/斜体答案标记。",
    type: "single",
    source: block.source || options.source
  }, block.rowNumber || fallbackRowNumber, format, {
    ...options,
    allowUnknownAnswer: true
  });
}

function normalizeQuestion(row, rowNumber, format, parseOptions = {}) {
  const question = String(row.question || "").trim();
  const answer = String(row.answer || "").trim().toUpperCase();
  const type = String(row.type || "single").trim().toLowerCase();
  const answerOptions = {
    A: String(row.options.A || "").trim(),
    B: String(row.options.B || "").trim(),
    C: String(row.options.C || "").trim(),
    D: String(row.options.D || "").trim()
  };

  if (!question) throw new Error(`${format} 第 ${rowNumber} 题缺少题干。`);
  letters.forEach((letter) => {
    if (!answerOptions[letter]) throw new Error(`${format} 第 ${rowNumber} 题缺少选项 ${letter}。`);
  });
  if (answer && !letters.includes(answer)) throw new Error(`${format} 第 ${rowNumber} 题答案必须是 A、B、C、D。`);
  if (!answer && !parseOptions.allowUnknownAnswer) throw new Error(`${format} 第 ${rowNumber} 题缺少答案。`);
  if (type && !["single", "singlechoice", "单选", "单选题"].includes(type)) {
    throw new Error(`${format} 第 ${rowNumber} 题暂只支持单选题。`);
  }

  return {
    question,
    options: answerOptions,
    answer: answer || "UNKNOWN",
    explanation: String(row.explanation || "").trim(),
    type: "single",
    source: String(row.source || "导入题库").trim()
  };
}

function parseCSVRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"") {
      if (quoted && next === "\"") {
        field += "\"";
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

function deleteBank(bankId) {
  const bank = state.banks.find((item) => item.id === bankId);
  if (!bank) return;
  if (!confirm(`删除题库「${bank.name}」？`)) return;
  bank.questions.forEach((question) => delete state.stats[question.id]);
  state.banks = state.banks.filter((item) => item.id !== bankId);
  saveState();
  render();
}

function deleteCollection(collectionId) {
  const collection = (state.collections || []).find((item) => item.id === collectionId);
  if (!collection) return;
  if (!confirm(`删除合集「${collection.name}」及其所有单元？`)) return;

  const unitIds = new Set(state.banks.filter((bank) => bank.collectionId === collectionId).map((bank) => bank.id));
  state.banks
    .filter((bank) => unitIds.has(bank.id))
    .forEach((bank) => bank.questions.forEach((question) => delete state.stats[question.id]));
  state.banks = state.banks.filter((bank) => bank.collectionId !== collectionId);
  state.collections = (state.collections || []).filter((item) => item.id !== collectionId);
  practiceSession.collectionId = null;
  saveState();
  render();
}

function showView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active-view"));
  document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
  document.querySelector(`#${name}View`).classList.add("active-view");
  render();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 3600);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "刷题数据备份.json";
  link.click();
  URL.revokeObjectURL(url);
}

document.querySelectorAll(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.view));
});

document.querySelectorAll(".segmented").forEach((button) => {
  button.addEventListener("click", () => {
    const currentIds = [...practiceSession.questionIds];
    practiceSession.mode = button.dataset.mode;
    practiceSession.questionIds = practiceSession.mode === "random" ? shuffle(currentIds) : currentIds;
    practiceSession.index = 0;
    practiceSession.selected = null;
    practiceSession.submitted = false;
    renderPractice();
  });
});

els.importButton.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files[0];
  if (file) handleFile(file);
});
els.backToBanks.addEventListener("click", () => showView("banks"));
els.backToCollections.addEventListener("click", () => showView("banks"));
els.startCollectionRandom.addEventListener("click", () => {
  const collection = getCurrentCollection();
  if (collection) {
    startCollectionPractice(collection.id, "random");
  }
});
els.submitButton.addEventListener("click", submitOrNext);
els.previousButton.addEventListener("click", previousQuestion);
els.practiceLayout.addEventListener("click", (event) => {
  if (!practiceSession.submitted) return;
  if (event.target.closest("#submitButton, #previousButton, #favoriteButton, #removeWrongButton, #backToBanks, .segmented")) return;
  nextQuestion();
});
document.querySelectorAll("[data-wrong-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    wrongFilter = button.dataset.wrongFilter;
    renderWrong();
  });
});
els.favoriteButton.addEventListener("click", () => {
  const question = getQuestion(practiceSession.questionIds[practiceSession.index]);
  if (!question) return;
  const stats = getStats(question.id);
  stats.isFavorite = !stats.isFavorite;
  saveState();
  renderPractice();
});
els.removeWrongButton.addEventListener("click", () => {
  const question = getQuestion(practiceSession.questionIds[practiceSession.index]);
  if (!question) return;
  getStats(question.id).isWrong = false;
  saveState();
  render();
});
els.exportButton.addEventListener("click", exportData);
els.resetProgressButton.addEventListener("click", () => {
  state.stats = {};
  saveState();
  render();
  showToast("已清空答题记录。");
});
els.clearAllButton.addEventListener("click", () => {
  if (!confirm("清空所有题库和答题记录？")) return;
  state = { banks: [], collections: [], stats: {} };
  saveState();
  render();
  ensureBuiltinModernHistory();
  showToast("已清空并重新加载基础题库。");
});

window.PracticeParser = {
  parseImportedText,
  parseTXTQuestions,
  parseJSONQuestions,
  parseCSVQuestions
};

render();
ensureBuiltinModernHistory();
