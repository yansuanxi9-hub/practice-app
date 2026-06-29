import SwiftUI

struct WrongQuestionsView: View {
    @EnvironmentObject private var store: PracticeStore

    var body: some View {
        let wrongQuestions = store.wrongQuestions()

        List {
            if wrongQuestions.isEmpty {
                ContentUnavailableView("暂无错题", systemImage: "checkmark.seal")
                    .listRowSeparator(.hidden)
            } else {
                Section {
                    NavigationLink {
                        PracticeView(title: "错题复刷", questions: wrongQuestions)
                    } label: {
                        Label("开始错题复刷", systemImage: "play.circle.fill")
                    }
                }

                Section("错题列表") {
                    ForEach(wrongQuestions) { question in
                        WrongQuestionRow(question: question, stats: store.stats(for: question))
                    }
                }
            }
        }
        .navigationTitle("错题本")
    }
}

private struct WrongQuestionRow: View {
    let question: PracticeQuestion
    let stats: QuestionStats

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(question.stem)
                .font(.headline)
                .lineLimit(2)

            Text(question.source)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                Text("答题 \(stats.attempts)")
                Text("错误 \(stats.wrongAttempts)")
                Text("连对 \(stats.consecutiveCorrect)")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    NavigationStack {
        WrongQuestionsView()
    }
    .environmentObject(PracticeStore())
}
