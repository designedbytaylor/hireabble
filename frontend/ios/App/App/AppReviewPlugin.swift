import Foundation
import WebKit
import StoreKit

/// Capacitor WKScriptMessageHandler that triggers the native App Store review prompt.
/// Called from the web layer via `window.webkit.messageHandlers.appReview.postMessage({ action: 'requestReview' })`.
class AppReviewPlugin: NSObject, WKScriptMessageHandler {

    weak var webView: WKWebView?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String,
              action == "requestReview" else {
            return
        }

        DispatchQueue.main.async {
            if let windowScene = UIApplication.shared.connectedScenes
                .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                SKStoreReviewController.requestReview(in: windowScene)
            }
        }
    }
}
