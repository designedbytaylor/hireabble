package com.hireabble.app;

import android.app.Activity;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;

import com.android.billingclient.api.*;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Google Play Billing bridge for the Capacitor WebView.
 *
 * Exposes window.Android.purchase() and window.Android.restorePurchases()
 * to the web layer, mirroring the iOS StoreKitPlugin pattern.
 *
 * Results are dispatched back via:
 *   window.dispatchEvent(new CustomEvent('googlePlayResponse', { detail: ... }))
 */
public class GooglePlayBillingPlugin implements PurchasesUpdatedListener {

    private static final String TAG = "GooglePlayBilling";

    private final Activity activity;
    private final WebView webView;
    private BillingClient billingClient;

    // Pending purchase metadata (set before launchBillingFlow)
    private String pendingTierId = "";
    private String pendingDuration = "";
    private String pendingJobId = "";

    public GooglePlayBillingPlugin(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        initBillingClient();
    }

    private void initBillingClient() {
        billingClient = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases()
                .build();

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    Log.i(TAG, "BillingClient connected");
                } else {
                    Log.w(TAG, "BillingClient setup failed: " + billingResult.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                Log.w(TAG, "BillingClient disconnected, will retry on next purchase");
            }
        });
    }

    private void ensureConnected(Runnable onConnected) {
        if (billingClient.isReady()) {
            onConnected.run();
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    onConnected.run();
                } else {
                    sendError("Failed to connect to Google Play: " + billingResult.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                sendError("Google Play Billing service disconnected");
            }
        });
    }

    // ==================== JS Interface ====================

    @JavascriptInterface
    public void purchase(String productId, String tierId, String duration) {
        purchaseWithJob(productId, tierId, duration, "");
    }

    @JavascriptInterface
    public void purchaseWithJob(String productId, String tierId, String duration, String jobId) {
        pendingTierId = tierId != null ? tierId : "";
        pendingDuration = duration != null ? duration : "";
        pendingJobId = jobId != null ? jobId : "";

        ensureConnected(() -> queryAndLaunch(productId));
    }

    @JavascriptInterface
    public void restorePurchases() {
        ensureConnected(this::queryExistingPurchases);
    }

    // ==================== Purchase Flow ====================

    private void queryAndLaunch(String productId) {
        // Try subscription first, fall back to in-app (one-time)
        QueryProductDetailsParams subsParams = QueryProductDetailsParams.newBuilder()
                .setProductList(List.of(
                        QueryProductDetailsParams.Product.newBuilder()
                                .setProductId(productId)
                                .setProductType(BillingClient.ProductType.SUBS)
                                .build()))
                .build();

        billingClient.queryProductDetailsAsync(subsParams, (billingResult, productDetailsList) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK
                    && productDetailsList != null && !productDetailsList.isEmpty()) {
                launchPurchaseFlow(productDetailsList.get(0), BillingClient.ProductType.SUBS);
                return;
            }

            // Not a subscription — try in-app product
            QueryProductDetailsParams inappParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(List.of(
                            QueryProductDetailsParams.Product.newBuilder()
                                    .setProductId(productId)
                                    .setProductType(BillingClient.ProductType.INAPP)
                                    .build()))
                    .build();

            billingClient.queryProductDetailsAsync(inappParams, (br2, pdl2) -> {
                if (br2.getResponseCode() == BillingClient.BillingResponseCode.OK
                        && pdl2 != null && !pdl2.isEmpty()) {
                    launchPurchaseFlow(pdl2.get(0), BillingClient.ProductType.INAPP);
                } else {
                    sendError("Product not found: " + productId);
                }
            });
        });
    }

    private void launchPurchaseFlow(ProductDetails productDetails, String productType) {
        List<BillingFlowParams.ProductDetailsParams> productList = new ArrayList<>();

        BillingFlowParams.ProductDetailsParams.Builder builder =
                BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails);

        // For subscriptions, pick the first offer (base plan)
        if (productType.equals(BillingClient.ProductType.SUBS)) {
            List<ProductDetails.SubscriptionOfferDetails> offers =
                    productDetails.getSubscriptionOfferDetails();
            if (offers != null && !offers.isEmpty()) {
                builder.setOfferToken(offers.get(0).getOfferToken());
            }
        }

        productList.add(builder.build());

        BillingFlowParams billingFlowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(productList)
                .build();

        activity.runOnUiThread(() ->
                billingClient.launchBillingFlow(activity, billingFlowParams));
    }

    // ==================== Purchase Callback ====================

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
        int code = billingResult.getResponseCode();

        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) {
                handlePurchase(purchase);
            }
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            sendToWebView("purchaseCancelled", null);
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            // Already owned — treat as restore
            queryExistingPurchases();
        } else {
            sendError("Purchase failed: " + billingResult.getDebugMessage());
        }
    }

    private void handlePurchase(Purchase purchase) {
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            // Send the purchase token to the web layer for server verification
            try {
                JSONObject data = new JSONObject();
                data.put("type", "purchaseSuccess");
                data.put("purchase_token", purchase.getPurchaseToken());
                data.put("product_id", purchase.getProducts().get(0));
                data.put("order_id", purchase.getOrderId());
                data.put("tier_id", pendingTierId);
                data.put("duration", pendingDuration);
                data.put("job_id", pendingJobId);
                sendRawToWebView(data.toString());
            } catch (JSONException e) {
                Log.e(TAG, "JSON error", e);
                sendError("Failed to process purchase data");
            }

            // Acknowledge the purchase (required within 3 days or it gets refunded)
            if (!purchase.isAcknowledged()) {
                AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(purchase.getPurchaseToken())
                        .build();
                billingClient.acknowledgePurchase(ackParams, ackResult -> {
                    if (ackResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        Log.w(TAG, "Acknowledge failed: " + ackResult.getDebugMessage());
                    }
                });
            }
        } else if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            sendToWebView("purchasePending", null);
        }
    }

    // ==================== Restore Purchases ====================

    private void queryExistingPurchases() {
        // Query subscriptions
        billingClient.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build(),
                (billingResult, subPurchases) -> {
                    List<Purchase> allPurchases = new ArrayList<>(subPurchases);

                    // Also query in-app purchases
                    billingClient.queryPurchasesAsync(
                            QueryPurchasesParams.newBuilder()
                                    .setProductType(BillingClient.ProductType.INAPP)
                                    .build(),
                            (br2, inappPurchases) -> {
                                allPurchases.addAll(inappPurchases);

                                if (allPurchases.isEmpty()) {
                                    sendToWebView("restoreEmpty", null);
                                    return;
                                }

                                for (Purchase purchase : allPurchases) {
                                    if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                        try {
                                            JSONObject data = new JSONObject();
                                            data.put("type", "restoreSuccess");
                                            data.put("purchase_token", purchase.getPurchaseToken());
                                            data.put("product_id", purchase.getProducts().get(0));
                                            data.put("order_id", purchase.getOrderId());
                                            sendRawToWebView(data.toString());
                                        } catch (JSONException e) {
                                            Log.e(TAG, "JSON error during restore", e);
                                        }
                                    }
                                }
                            });
                });
    }

    // ==================== WebView Communication ====================

    private void sendToWebView(String type, String extraJson) {
        try {
            JSONObject data = new JSONObject();
            data.put("type", type);
            if (extraJson != null) {
                data.put("extra", extraJson);
            }
            sendRawToWebView(data.toString());
        } catch (JSONException e) {
            Log.e(TAG, "JSON error", e);
        }
    }

    private void sendError(String message) {
        try {
            JSONObject data = new JSONObject();
            data.put("type", "purchaseError");
            data.put("error", message);
            sendRawToWebView(data.toString());
        } catch (JSONException e) {
            Log.e(TAG, "JSON error in sendError", e);
        }
    }

    private void sendRawToWebView(String jsonString) {
        String js = "window.dispatchEvent(new CustomEvent('googlePlayResponse', { detail: " + jsonString + " }));";
        activity.runOnUiThread(() -> webView.evaluateJavascript(js, null));
    }

    /**
     * Call this when the activity is destroyed to prevent leaks.
     */
    public void destroy() {
        if (billingClient != null) {
            billingClient.endConnection();
        }
    }
}
