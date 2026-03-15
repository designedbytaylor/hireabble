import Foundation
import WebKit
import StoreKit

@available(iOS 15.0, *)
class StoreKitPlugin: NSObject, WKScriptMessageHandler {

    weak var webView: WKWebView?
    private var products: [String: Product] = [:]

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            return
        }

        switch action {
        case "purchase":
            guard let productId = body["productId"] as? String else { return }
            let tierId = body["tier_id"] as? String ?? ""
            let duration = body["duration"] as? String ?? ""
            let jobId = body["job_id"] as? String
            Task {
                await handlePurchase(productId: productId, tierId: tierId, duration: duration, jobId: jobId)
            }
        case "restore":
            Task {
                await handleRestore()
            }
        default:
            break
        }
    }

    // MARK: - Purchase

    private func handlePurchase(productId: String, tierId: String, duration: String, jobId: String?) async {
        do {
            // Fetch product from App Store
            let storeProducts = try await Product.products(for: [productId])
            guard let product = storeProducts.first else {
                await sendError("Product not found: \(productId)")
                return
            }

            // Initiate purchase
            let result = try await product.purchase()

            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)

                // Get the app receipt for server verification
                if let receiptURL = Bundle.main.appStoreReceiptURL,
                   let receiptData = try? Data(contentsOf: receiptURL) {
                    let receiptBase64 = receiptData.base64EncodedString()

                    // Send receipt to web view for backend verification
                    await sendToWebView([
                        "type": "purchaseSuccess",
                        "receipt_data": receiptBase64,
                        "product_id": productId,
                        "transaction_id": String(transaction.id),
                        "tier_id": tierId,
                        "duration": duration,
                        "job_id": jobId ?? ""
                    ])
                }

                // Finish the transaction
                await transaction.finish()

            case .userCancelled:
                await sendToWebView(["type": "purchaseCancelled"])

            case .pending:
                await sendToWebView(["type": "purchasePending"])

            @unknown default:
                await sendError("Unknown purchase result")
            }
        } catch {
            await sendError(error.localizedDescription)
        }
    }

    // MARK: - Restore

    private func handleRestore() async {
        var restored = 0

        for await result in Transaction.currentEntitlements {
            do {
                let transaction = try checkVerified(result)

                if let receiptURL = Bundle.main.appStoreReceiptURL,
                   let receiptData = try? Data(contentsOf: receiptURL) {
                    let receiptBase64 = receiptData.base64EncodedString()

                    await sendToWebView([
                        "type": "restoreSuccess",
                        "receipt_data": receiptBase64,
                        "product_id": transaction.productID,
                        "transaction_id": String(transaction.id)
                    ])
                    restored += 1
                }
            } catch {
                continue
            }
        }

        if restored == 0 {
            await sendToWebView(["type": "restoreEmpty"])
        }
    }

    // MARK: - Helpers

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let safe):
            return safe
        }
    }

    @MainActor
    private func sendToWebView(_ data: [String: Any]) {
        guard let webView = webView else { return }
        if let jsonData = try? JSONSerialization.data(withJSONObject: data),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            let js = "window.dispatchEvent(new CustomEvent('storeKitResponse', { detail: \(jsonString) }));"
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    @MainActor
    private func sendError(_ message: String) {
        sendToWebView(["type": "purchaseError", "error": message])
    }
}
