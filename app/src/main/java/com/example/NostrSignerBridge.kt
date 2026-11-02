package com.example

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.FragmentActivity
import org.json.JSONObject

class NostrSignerBridge(
    private val activity: Activity,
    private val webView: WebView
) {
    private val sharedPreferences = activity.getSharedPreferences("mojisurvivor_prefs", Context.MODE_PRIVATE)
    private var pendingCallbackId: String? = null
    private var pendingAction: String? = null

    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vibratorManager = activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vibratorManager?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        activity.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    fun handleSignerResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val callbackId = pendingCallbackId ?: return
        val action = pendingAction ?: return

        pendingCallbackId = null
        pendingAction = null

        if (resultCode == Activity.RESULT_OK && data != null) {
            val result = when (action) {
                "get_public_key" -> {
                    val pubkey = data.getStringExtra("signature")
                        ?: data.getStringExtra("result")
                        ?: data.getStringExtra("pubkey")
                        ?: data.data?.toString() ?: ""
                    JSONObject().apply {
                        put("status", "success")
                        put("pubkey", pubkey)
                    }.toString()
                }
                "sign_event" -> {
                    val signature = data.getStringExtra("signature") ?: ""
                    val event = data.getStringExtra("event") ?: ""
                    JSONObject().apply {
                        put("status", "success")
                        put("signature", signature)
                        put("event", event)
                    }.toString()
                }
                else -> {
                    JSONObject().apply {
                        put("status", "error")
                        put("message", "Unknown action")
                    }.toString()
                }
            }
            sendJsResult(callbackId, result)
        } else {
            val errorJson = JSONObject().apply {
                put("status", "cancelled")
                put("message", "Signer cancelled or failed")
            }.toString()
            sendJsResult(callbackId, errorJson)
        }
    }

    private fun sendJsResult(callbackId: String, resultJson: String) {
        val escaped = JSONObject.quote(resultJson)
        activity.runOnUiThread {
            webView.evaluateJavascript("window.onAmberResult && window.onAmberResult('$callbackId', $escaped);", null)
        }
    }

    @JavascriptInterface
    fun isAmberInstalled(): Boolean {
        return try {
            val packageManager = activity.packageManager
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"))
            val resolveInfo = packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
            resolveInfo.isNotEmpty()
        } catch (e: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun requestExternalPublicKey(callbackId: String) {
        pendingCallbackId = callbackId
        pendingAction = "get_public_key"
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:")).apply {
                    putExtra("type", "get_public_key")
                }
                activity.startActivityForResult(intent, REQUEST_CODE_SIGNER)
            } catch (e: Exception) {
                val errorJson = JSONObject().apply {
                    put("status", "error")
                    put("message", e.localizedMessage ?: "Signer launch failed")
                }.toString()
                sendJsResult(callbackId, errorJson)
            }
        }
    }

    @JavascriptInterface
    fun requestSignEvent(callbackId: String, eventJson: String) {
        pendingCallbackId = callbackId
        pendingAction = "sign_event"
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:$eventJson")).apply {
                    putExtra("type", "sign_event")
                }
                activity.startActivityForResult(intent, REQUEST_CODE_SIGNER)
            } catch (e: Exception) {
                val errorJson = JSONObject().apply {
                    put("status", "error")
                    put("message", e.localizedMessage ?: "Signer launch failed")
                }.toString()
                sendJsResult(callbackId, errorJson)
            }
        }
    }

    @JavascriptInterface
    fun vibrate(durationMs: Long) {
        try {
            vibrator?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    it.vibrate(VibrationEffect.createOneShot(durationMs.coerceIn(5, 500), VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    it.vibrate(durationMs.coerceIn(5, 500))
                }
            }
        } catch (_: Exception) {}
    }

    @JavascriptInterface
    fun saveGameState(json: String) {
        sharedPreferences.edit().putString("game_state", json).apply()
    }

    @JavascriptInterface
    fun getSavedGameState(): String {
        return sharedPreferences.getString("game_state", "") ?: ""
    }

    @JavascriptInterface
    fun getPlatformInfo(): String {
        return JSONObject().apply {
            put("platform", "android")
            put("amberAvailable", isAmberInstalled())
            put("appVersion", "1.0.0")
        }.toString()
    }

    companion object {
        const val REQUEST_CODE_SIGNER = 9182
    }
}
