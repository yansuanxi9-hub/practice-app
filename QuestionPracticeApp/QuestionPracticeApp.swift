import SwiftUI

@main
struct QuestionPracticeApp: App {
    @StateObject private var store = PracticeStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
        }
    }
}
