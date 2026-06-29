import Foundation

enum QuestionType: String, Codable, CaseIterable, Identifiable {
    case singleChoice = "单选题"

    var id: String { rawValue }
}

struct PracticeQuestion: Identifiable, Hashable, Codable {
    let id: UUID
    let bankID: UUID
    var stem: String
    var options: [String]
    var correctAnswer: String
    var explanation: String
    var type: QuestionType
    var source: String

    init(
        id: UUID = UUID(),
        bankID: UUID,
        stem: String,
        options: [String],
        correctAnswer: String,
        explanation: String,
        type: QuestionType = .singleChoice,
        source: String
    ) {
        self.id = id
        self.bankID = bankID
        self.stem = stem
        self.options = options
        self.correctAnswer = correctAnswer
        self.explanation = explanation
        self.type = type
        self.source = source
    }
}

struct QuestionBank: Identifiable, Hashable, Codable {
    let id: UUID
    var name: String
    var description: String

    init(id: UUID = UUID(), name: String, description: String) {
        self.id = id
        self.name = name
        self.description = description
    }
}

struct QuestionStats: Codable, Hashable {
    var attempts: Int = 0
    var wrongAttempts: Int = 0
    var consecutiveCorrect: Int = 0
    var isWrong: Bool = false
    var isFavorite: Bool = false
    var lastAnsweredAt: Date?
}

struct PracticeSummary {
    var totalCount: Int
    var practicedCount: Int
    var wrongCount: Int
}
