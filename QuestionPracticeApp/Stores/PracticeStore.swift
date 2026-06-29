import Foundation

@MainActor
final class PracticeStore: ObservableObject {
    @Published private(set) var banks: [QuestionBank] = []
    @Published private(set) var questions: [PracticeQuestion] = []
    @Published private(set) var statsByQuestionID: [UUID: QuestionStats] = [:]

    private let statsStorageKey = "questionPractice.stats.v1"
    private let importedDataStorageKey = "questionPractice.importedData.v1"

    init() {
        seedSampleData()
        loadImportedData()
        loadStats()
    }

    func questions(in bank: QuestionBank) -> [PracticeQuestion] {
        questions.filter { $0.bankID == bank.id }
    }

    func wrongQuestions() -> [PracticeQuestion] {
        questions.filter { stats(for: $0).isWrong }
    }

    func summary(for bank: QuestionBank) -> PracticeSummary {
        let bankQuestions = questions(in: bank)
        let practicedCount = bankQuestions.filter { stats(for: $0).attempts > 0 }.count
        let wrongCount = bankQuestions.filter { stats(for: $0).isWrong }.count

        return PracticeSummary(
            totalCount: bankQuestions.count,
            practicedCount: practicedCount,
            wrongCount: wrongCount
        )
    }

    func stats(for question: PracticeQuestion) -> QuestionStats {
        statsByQuestionID[question.id] ?? QuestionStats()
    }

    func recordAnswer(question: PracticeQuestion, selectedAnswer: String) -> Bool {
        let isCorrect = selectedAnswer == question.correctAnswer
        var stats = stats(for: question)

        stats.attempts += 1
        stats.lastAnsweredAt = Date()

        if isCorrect {
            stats.consecutiveCorrect += 1
        } else {
            stats.wrongAttempts += 1
            stats.consecutiveCorrect = 0
            stats.isWrong = true
        }

        statsByQuestionID[question.id] = stats
        saveStats()
        return isCorrect
    }

    func toggleFavorite(question: PracticeQuestion) {
        var stats = stats(for: question)
        stats.isFavorite.toggle()
        statsByQuestionID[question.id] = stats
        saveStats()
    }

    func removeFromWrongQuestions(_ question: PracticeQuestion) {
        var stats = stats(for: question)
        stats.isWrong = false
        statsByQuestionID[question.id] = stats
        saveStats()
    }

    func resetProgress() {
        statsByQuestionID = [:]
        saveStats()
    }

    @discardableResult
    func importQuestionBank(from url: URL) throws -> QuestionBank {
        let drafts = try QuestionImporter.importDrafts(from: url)

        guard !drafts.isEmpty else {
            throw QuestionImportError.emptyFile
        }

        let bankName = makeBankName(from: drafts, fileURL: url)
        let bank = QuestionBank(
            name: bankName,
            description: "\(drafts.count) 道题，来自 \(url.lastPathComponent)"
        )
        let importedQuestions = drafts.map { draft in
            PracticeQuestion(
                bankID: bank.id,
                stem: draft.stem,
                options: draft.options,
                correctAnswer: draft.correctAnswer,
                explanation: draft.explanation,
                type: draft.type,
                source: draft.source
            )
        }

        banks.append(bank)
        questions.append(contentsOf: importedQuestions)
        saveImportedData()
        return bank
    }

    private func loadStats() {
        guard let data = UserDefaults.standard.data(forKey: statsStorageKey) else {
            return
        }

        do {
            statsByQuestionID = try JSONDecoder().decode([UUID: QuestionStats].self, from: data)
        } catch {
            statsByQuestionID = [:]
        }
    }

    private func saveStats() {
        do {
            let data = try JSONEncoder().encode(statsByQuestionID)
            UserDefaults.standard.set(data, forKey: statsStorageKey)
        } catch {
            assertionFailure("Failed to save stats: \(error)")
        }
    }

    private func loadImportedData() {
        guard let data = UserDefaults.standard.data(forKey: importedDataStorageKey) else {
            return
        }

        do {
            let importedData = try JSONDecoder().decode(ImportedQuestionData.self, from: data)
            banks.append(contentsOf: importedData.banks)
            questions.append(contentsOf: importedData.questions)
        } catch {
            assertionFailure("Failed to load imported question data: \(error)")
        }
    }

    private func saveImportedData() {
        let sampleBankIDs = Set(sampleBanks.map(\.id))
        let importedBanks = banks.filter { !sampleBankIDs.contains($0.id) }
        let importedBankIDs = Set(importedBanks.map(\.id))
        let importedQuestions = questions.filter { importedBankIDs.contains($0.bankID) }
        let importedData = ImportedQuestionData(banks: importedBanks, questions: importedQuestions)

        do {
            let data = try JSONEncoder().encode(importedData)
            UserDefaults.standard.set(data, forKey: importedDataStorageKey)
        } catch {
            assertionFailure("Failed to save imported question data: \(error)")
        }
    }

    private func makeBankName(from drafts: [ImportedQuestionDraft], fileURL: URL) -> String {
        if let source = drafts.map(\.source).first(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
            return source
        }

        return fileURL.deletingPathExtension().lastPathComponent
    }

    private func seedSampleData() {
        let seededBanks = sampleBanks
        let swiftBank = seededBanks[0]
        let generalBank = seededBanks[1]

        banks = seededBanks
        questions = sampleQuestions(swiftBank: swiftBank, generalBank: generalBank)
    }

    private var sampleBanks: [QuestionBank] {
        let swiftBank = QuestionBank(
            id: UUID(uuidString: "1D45B6CE-6613-4D02-A6A2-4DD3B81378C1")!,
            name: "SwiftUI 入门示例",
            description: "用于验证第一阶段刷题流程"
        )
        let generalBank = QuestionBank(
            id: UUID(uuidString: "63A639D8-D85D-4FC3-8E4D-08F10F0D0BF4")!,
            name: "通用常识示例",
            description: "少量单选题，方便测试错题本"
        )

        return [swiftBank, generalBank]
    }

    private func sampleQuestions(swiftBank: QuestionBank, generalBank: QuestionBank) -> [PracticeQuestion] {
        [
            PracticeQuestion(
                id: UUID(uuidString: "87285E3B-8EB5-44C5-932C-BD7CD1097F88")!,
                bankID: swiftBank.id,
                stem: "SwiftUI 中用于声明 App 入口的属性包装器/标记是什么？",
                options: ["@main", "@State", "@Binding", "@Environment"],
                correctAnswer: "A",
                explanation: "@main 标记程序入口类型。@State、@Binding 和 @Environment 用于管理视图状态或环境值。",
                source: swiftBank.name
            ),
            PracticeQuestion(
                id: UUID(uuidString: "2A4BF98A-5585-4E51-B243-C2785C9CD264")!,
                bankID: swiftBank.id,
                stem: "下面哪一个更适合在多个页面共享刷题状态？",
                options: ["局部 let 常量", "@StateObject 创建的 ObservableObject", "普通 String", "只写在 Button 里的临时变量"],
                correctAnswer: "B",
                explanation: "跨页面共享且会变化的数据适合放进 ObservableObject，并通过 environmentObject 等方式传递。",
                source: swiftBank.name
            ),
            PracticeQuestion(
                id: UUID(uuidString: "010C1A2D-C68E-4931-A464-C4D146F5108D")!,
                bankID: swiftBank.id,
                stem: "本 App 第一阶段使用哪种方式保存答题记录？",
                options: ["服务器数据库", "UserDefaults + Codable", "CloudKit", "不保存任何数据"],
                correctAnswer: "B",
                explanation: "第一阶段先保存少量本地答题状态，后续导入题库和数据量变大后再迁移到 SwiftData。",
                source: swiftBank.name
            ),
            PracticeQuestion(
                id: UUID(uuidString: "F4E11554-C371-4275-93AB-3185121BF7D7")!,
                bankID: generalBank.id,
                stem: "中国标准时间所在时区是？",
                options: ["UTC+6", "UTC+7", "UTC+8", "UTC+9"],
                correctAnswer: "C",
                explanation: "中国标准时间为 UTC+8。",
                source: generalBank.name
            ),
            PracticeQuestion(
                id: UUID(uuidString: "509D245E-5F51-4F11-A992-7C84B1C9F58C")!,
                bankID: generalBank.id,
                stem: "CSV 文件名通常表示什么类型的数据？",
                options: ["逗号分隔的表格数据", "压缩图片", "视频流", "可执行程序"],
                correctAnswer: "A",
                explanation: "CSV 是 Comma-Separated Values，常用于保存表格型文本数据。",
                source: generalBank.name
            )
        ]
    }
}

private struct ImportedQuestionData: Codable {
    var banks: [QuestionBank]
    var questions: [PracticeQuestion]
}
