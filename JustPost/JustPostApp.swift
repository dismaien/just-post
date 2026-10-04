import SwiftUI

@main
struct JustPostApp: App {
    @StateObject private var web = WebState()

    var body: some Scene {
        WindowGroup {
            ZStack {
                Color(.systemBackground).ignoresSafeArea()
                XWebView(state: web)

                if let error = web.error {
                    VStack(spacing: 12) {
                        Text("couldn't reach x.").font(.headline)
                        Text(error).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        Button("try again") { web.retry() }.buttonStyle(.borderedProminent)
                    }
                    .padding(32)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.systemBackground))
                } else if web.loading {
                    ProgressView()
                }
            }
        }
    }
}
