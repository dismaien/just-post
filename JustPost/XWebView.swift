import SwiftUI
import WebKit

/// What the web view is doing, so the app can show a spinner or an error instead of a blank screen.
final class WebState: ObservableObject {
    @Published var loading = true
    @Published var error: String?
    weak var web: WKWebView?

    func retry() {
        error = nil
        loading = true
        if let web, web.url != nil { web.reload() } else { web?.load(URLRequest(url: XWebView.home)) }
    }
}

/// x.com's mobile site with the feed-hiding script injected into every page.
/// Cookies live in the default data store, so the login sticks between launches.
struct XWebView: UIViewRepresentable {
    static let home = URL(string: "https://x.com/home")!

    @ObservedObject var state: WebState

    func makeCoordinator() -> Coordinator { Coordinator(state: state) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.applicationNameForUserAgent = "Version/26.0 Mobile/15E148 Safari/604.1"
        if let url = Bundle.main.url(forResource: "feedless", withExtension: "js"),
           let source = try? String(contentsOf: url, encoding: .utf8) {
            config.userContentController.addUserScript(
                WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
            )
        }

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = .systemBackground
        #if DEBUG
        web.isInspectable = true // lets Safari's Develop menu on a Mac inspect the page
        #endif

        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.reload(_:)), for: .valueChanged)
        web.scrollView.refreshControl = refresh
        context.coordinator.web = web
        state.web = web

        web.load(URLRequest(url: Self.home))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        weak var web: WKWebView?
        let state: WebState

        init(state: WebState) { self.state = state }

        private static let xHosts = ["x.com", "twitter.com"]
        // Sign-in pages X's login can hand off to. They load in here so the session lands in the app.
        private static let authHosts = ["appleid.apple.com", "accounts.google.com"]

        private func matches(_ url: URL, _ hosts: [String]) -> Bool {
            guard url.scheme == "https", let host = url.host?.lowercased() else { return false }
            return hosts.contains { host == $0 || host.hasSuffix("." + $0) }
        }

        private func openOutside(_ url: URL) {
            guard url.scheme == "https" || url.scheme == "http" else { return }
            UIApplication.shared.open(url)
        }

        @objc func reload(_ sender: UIRefreshControl) {
            web?.reload()
            sender.endRefreshing()
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            state.loading = true
            state.error = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            state.loading = false
            state.error = nil
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            fail(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            fail(error)
        }

        private func fail(_ error: Error) {
            // Cancelled loads (a redirect, or a link handed to the browser) aren't real failures.
            state.loading = false
            if (error as NSError).code == NSURLErrorCancelled { return }
            state.error = error.localizedDescription
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }

        // The app itself only ever shows x.com (and sign-in pages). Other websites open in the
        // phone's browser; other URL schemes are dropped. Iframes (login captchas, embeds) are
        // left alone.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.cancel) }
            if url.scheme == "about" { return decisionHandler(.allow) }
            if action.targetFrame?.isMainFrame == false {
                let webSchemes = ["https", "http", "blob", "data"]
                return decisionHandler(webSchemes.contains(url.scheme ?? "") ? .allow : .cancel)
            }
            if matches(url, Self.xHosts) || matches(url, Self.authHosts) {
                return decisionHandler(.allow)
            }
            openOutside(url)
            decisionHandler(.cancel)
        }

        // target="_blank" / window.open: x.com stays in the app, other websites go to the browser.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            guard let url = action.request.url else { return nil }
            if matches(url, Self.xHosts) { webView.load(action.request) } else { openOutside(url) }
            return nil
        }
    }
}
