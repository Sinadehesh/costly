package app.costly.companion.net

import android.content.Context
import android.os.Build
import android.util.Log
import app.costly.companion.Prefs

/**
 * Exchanges the dashboard OTP for a per-device secret and persists it. After
 * this succeeds, Prefs holds {deviceSecret, userId} and Network.deviceSecret
 * is live, so every subsequent call authenticates as this device.
 */
object DeviceLinker {

    suspend fun link(context: Context, otp: String): Result<Unit> = runCatching {
        val label = "${Build.MANUFACTURER} ${Build.MODEL}".trim().take(64)
        val response = Network.api.linkDevice(LinkDeviceRequest(otp = otp.trim(), label = label))
        Prefs.setLink(context, deviceSecret = response.deviceSecret, userId = response.userId)
        Network.deviceSecret = response.deviceSecret
        Log.i(TAG, "Device linked for user ${response.userId}")
        Unit // pin the block's type to Result<Unit> (Log.i returns Int)
    }.onFailure { Log.w(TAG, "device link failed", it) }

    private const val TAG = "CostlyLink"
}
