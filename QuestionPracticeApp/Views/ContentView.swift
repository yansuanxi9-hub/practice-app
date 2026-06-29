import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            NavigationStack {
                HomeView()
            }
            .tabItem {
                Label("题库", systemImage: "books.vertical")
            }

            NavigationStack {
                WrongQuestionsView()
            }
            .tabItem {
                Label("错题", systemImage: "exclamationmark.circle")
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(PracticeStore())
}
