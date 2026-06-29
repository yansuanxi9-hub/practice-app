import SwiftUI

struct PracticeView: View {
    @EnvironmentObject private var store: PracticeStore

    let title: String
    let questions: [PracticeQuestion]

    @State private var currentIndex = 0
    @State private var selectedAnswer: String?
    @State private var answerResult: Bool?

    private var currentQuestion: PracticeQuestion? {
        guard questions.indices.contains(currentIndex) else {
            return nil
        }
        return questions[currentIndex]
    }

    var body: some View {
        Group {
            if let question = currentQuestion {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        progressHeader
                        questionCard(question)
                        optionList(question)
                        actionArea(question)
                    }
                    .padding()
                }
            } else {
                ContentUnavailableView("暂无题目", systemImage: "doc.text.magnifyingglass")
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var progressHeader: some View {
        HStack {
            Text("\(currentIndex + 1)/\(questions.count)")
                .font(.headline)

            Spacer()

            if let question = currentQuestion {
                Button {
                    store.toggleFavorite(question: question)
                } label: {
                    Image(systemName: store.stats(for: question).isFavorite ? "star.fill" : "star")
                }
                .accessibilityLabel("收藏")
            }
        }
    }

    private func questionCard(_ question: PracticeQuestion) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(question.type.rawValue)
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(question.stem)
                .font(.title3)
                .fontWeight(.semibold)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func optionList(_ question: PracticeQuestion) -> some View {
        VStack(spacing: 12) {
            ForEach(Array(question.options.enumerated()), id: \.offset) { index, option in
                let answer = answerLetter(at: index)
                Button {
                    selectedAnswer = answer
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        Text(answer)
                            .font(.headline)
                            .frame(width: 28, height: 28)
                            .background(optionBackground(answer, question: question))
                            .foregroundStyle(optionForeground(answer, question: question))
                            .clipShape(Circle())

                        Text(option)
                            .foregroundStyle(.primary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding()
                    .background(.background)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(optionBorder(answer, question: question), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(answerResult != nil)
            }
        }
    }

    private func actionArea(_ question: PracticeQuestion) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if let answerResult {
                VStack(alignment: .leading, spacing: 8) {
                    Text(answerResult ? "回答正确" : "回答错误")
                        .font(.headline)
                        .foregroundStyle(answerResult ? .green : .red)

                    Text("正确答案：\(question.correctAnswer)")
                        .font(.subheadline)

                    Text(question.explanation)
                        .font(.body)
                        .foregroundStyle(.secondary)

                    let stats = store.stats(for: question)
                    if stats.isWrong && stats.consecutiveCorrect >= 2 {
                        Button {
                            store.removeFromWrongQuestions(question)
                        } label: {
                            Label("从错题本移除", systemImage: "checkmark.circle")
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.thinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            Button {
                handlePrimaryAction(question)
            } label: {
                Text(answerResult == nil ? "提交答案" : "下一题")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(selectedAnswer == nil && answerResult == nil)
        }
    }

    private func handlePrimaryAction(_ question: PracticeQuestion) {
        if answerResult == nil, let selectedAnswer {
            answerResult = store.recordAnswer(question: question, selectedAnswer: selectedAnswer)
            return
        }

        if currentIndex < questions.count - 1 {
            currentIndex += 1
        } else {
            currentIndex = 0
        }

        selectedAnswer = nil
        answerResult = nil
    }

    private func answerLetter(at index: Int) -> String {
        ["A", "B", "C", "D"][index]
    }

    private func optionBackground(_ answer: String, question: PracticeQuestion) -> Color {
        guard answerResult != nil else {
            return selectedAnswer == answer ? .accentColor : .secondary.opacity(0.16)
        }

        if answer == question.correctAnswer {
            return .green
        }

        if selectedAnswer == answer {
            return .red
        }

        return .secondary.opacity(0.16)
    }

    private func optionForeground(_ answer: String, question: PracticeQuestion) -> Color {
        if answerResult != nil && (answer == question.correctAnswer || selectedAnswer == answer) {
            return .white
        }

        return selectedAnswer == answer ? .white : .primary
    }

    private func optionBorder(_ answer: String, question: PracticeQuestion) -> Color {
        guard answerResult != nil else {
            return selectedAnswer == answer ? .accentColor : .secondary.opacity(0.24)
        }

        if answer == question.correctAnswer {
            return .green
        }

        if selectedAnswer == answer {
            return .red
        }

        return .secondary.opacity(0.24)
    }
}

#Preview {
    let store = PracticeStore()

    return NavigationStack {
        PracticeView(title: "预览题库", questions: store.questions)
    }
    .environmentObject(store)
}
