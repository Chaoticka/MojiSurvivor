package com.example

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.BreBreBlack
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

    private var bridge: NostrSignerBridge? = null
    private var webViewInstance: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            MyApplicationTheme {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(BreBreBlack)
                        .windowInsetsPadding(WindowInsets.safeDrawing)
                ) {
                    MojiSurvivorWebViewContainer(
                        activity = this@MainActivity,
                        onBridgeCreated = { b, wv ->
                            bridge = b
                            webViewInstance = wv
                        }
                    )
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == NostrSignerBridge.REQUEST_CODE_SIGNER) {
            bridge?.handleSignerResult(requestCode, resultCode, data)
        }
    }

    override fun onDestroy() {
        webViewInstance?.destroy()
        super.onDestroy()
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun MojiSurvivorWebViewContainer(
    activity: MainActivity,
    onBridgeCreated: (NostrSignerBridge, WebView) -> Unit
) {
    BackHandler {
        // Evaluate in-game back handler
        activity.runOnUiThread {
            // In-game back navigation if needed
        }
    }

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            WebView(context).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                setBackgroundColor(Color.BLACK)
                setLayerType(View.LAYER_TYPE_HARDWARE, null)

                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    allowFileAccess = true
                    allowContentAccess = true
                    @Suppress("DEPRECATION")
                    allowFileAccessFromFileURLs = true
                    @Suppress("DEPRECATION")
                    allowUniversalAccessFromFileURLs = true
                    cacheMode = WebSettings.LOAD_DEFAULT
                    mediaPlaybackRequiresUserGesture = false
                    useWideViewPort = true
                    loadWithOverviewMode = true
                }

                val bridge = NostrSignerBridge(activity, this)
                addJavascriptInterface(bridge, "AndroidNostrBridge")
                onBridgeCreated(bridge, this)

                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                        Log.d("MojiSurvivorJS", "${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                        return true
                    }
                }

                webViewClient = object : WebViewClient() {
                    override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                        super.onReceivedError(view, request, error)
                        Log.e("MojiSurvivorWV", "Error: ${error?.description} for ${request?.url}")
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        Log.d("MojiSurvivorWV", "Page loaded: $url")
                    }
                }

                loadUrl("file:///android_asset/index.html")
            }
        }
    )
}
