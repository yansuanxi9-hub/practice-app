import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var store: PracticeStore
    @State private var isShowingImporter = false
    @State private var importResultMessage: String?
    @State private var importErrorMessage: String?

    var body: some View {
        List {
            Section {
                ForEach(store.banks) { bank in
                    NavigationLink {
                        PracticeView(title: bank.name, questions: store.questions(in: bank))
                    } label: {
                        BankRow(bank: bank, summary: store.summary(for: bank))
                    }
                }
            } header: {
                Text("本地题库")
            } footer: {
                Text("支持导入 json、csv、txt；docx 会尝试读取纯文本后按 txt 模板解析。")
            }
        }
        .navigationTitle("刷题")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    isShowingImporter = true
                } label: {
                    Label("导入", systemImage: "square.and.arrow.down")
                }
            }

            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    store.resetProgress()
                } label: {
                    Label("重置进度", systemImage: "arrow.counterclockwise")
                }
            }
        }
        .fileImporter(
            isPresented: $isShowingImporter,
            allowedContentTypes: QuestionImporter.allowedContentTypes,
            allowsMultipleSelection: false
        ) { result in
            handleImportResult(result)
        }
        .alert("导入成功", isPresented: successAlertBinding) {
            Button("好", role: .cancel) {}
        } message: {
            Text(importResultMessage ?? "")
        }
        .alert("导入失败", isPresented: errorAlertBinding) {
            Button("好", role: .cancel) {}
        } message: {
            Text(importErrorMessage ?? "")
        }
    }

    private var successAlertBinding: Binding<Bool> {
        Binding(
            get: { importResultMessage != nil },
            set: { isPresented in
                if !isPresented {
                    importResultMessage = nil
                }
            }
        )
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(
            get: { importErrorMessage != nil },
            set: { isPresented in
                if !isPresented {
                    importErrorMessage = nil
                }
            }
        )
    }

    private func handleImportResult(_ result: Result<[URL], Error>) {
        do {
            guard let url = try result.get().first else {
                return
            }

            let bank = try store.importQuestionBank(from: url)
            let summary = store.summary(for: bank)
            importResultMessage = "已导入「\(bank.name)」，共 \(summary.totalCount) 道题。"
        } catch {
            importErrorMessage = error.localizedDescription
        }
    }
}

private struct BankRow: View {
    let bank: QuestionBank
    let summary: PracticeSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(bank.name)
                .font(.headline)

            Text(bank.description)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                StatBadge(title: "题目", value: summary.totalCount)
                StatBadge(title: "已刷", value: summary.practicedCount)
                StatBadge(title: "错题", value: summary.wrongCount)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct StatBadge: View {
    let title: String
    let value: Int

    var body: some View {
        Text("\(title) \(value)")
            .font(.caption)
            .foregroundStyle(.secondary)
    }
}

#Preview {
    NavigationStack {
        HomeView()
    }
    .environmentObject(PracticeStore())
}
