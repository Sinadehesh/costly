package app.costly.companion.net

import android.content.Context
import android.os.Build
import android.util.Log
import app.costly.companion.Prefs

/**
 * Binds this device to an account and persists the credential. Afterwards
 * Prefs holds {deviceSecret, userId} and Network.deviceSecret is live, so
 * every subsequent call authenticates as this device.
 *
 * Two ways in:
 *
 *  - signIn(): ordinary email + password, which is what a phone should do.
 *    The password is sent once and never stored; what comes back and IS kept
 *    is a per-device secret, so this device can be revoked on its own without
 *    touching the account or any other device.
 *  - link(): the legacy 6-digit pairing code. That pattern exists for devices
 *    that cannot take input — TVs, consoles — and asked the user to transcribe
 *    a number between two of their own screens. Kept only so devices paired
 *    under the old flow keep working.
 */
object DeviceLinker {

    private fun deviceLabel(): String =
        "${Build.MANUFACTURER} ${Build.MODEL}".trim().take(64)

    /**
     * Google Sign-In: the account sheet, then a verified ID token traded for a
     * device secret. One tap, no password, and nothing to type.
     */
    suspend fun signInWithGoogle(context: Context): Result<Unit> = runCatching {
        val idToken = GoogleAuth.idToken(context).getOrThrow()
        val response = Network.api.googleLogin(
            GoogleLoginRequest(idToken = idToken, deviceLabel = deviceLabel()),
        )
        val secret = requireNotNull(response.deviceSecret) { "server returned no device secret" }
        Prefs.setLink(context, deviceSecret = secret, userId = response.userId)
        response.sessionToken?.let { Prefs.setSessionToken(context, it) }
        Network.deviceSecret = secret
        Log.i(TAG, "Signed in with Google as ${response.userId}")
        Unit
    }.onFailure { Log.w(TAG, "google sign-in failed", it) }

    suspend fun signIn(context: Context, email: String, password: String): Result<Unit> =
        runCatching {
            val response = Network.api.login(
                LoginRequest(
                    email = email.trim(),
                    password = password,
                    deviceLabel = deviceLabel(),
                ),
            )
            val secret = requireNotNull(response.deviceSecret) { "server returned no device secret" }
            Prefs.setLink(context, deviceSecret = secret, userId = response.userId)
            response.sessionToken?.let { Prefs.setSessionToken(context, it) }
            Network.deviceSecret = secret
            Log.i(TAG, "Signed in as ${response.userId}")
            Unit // pin the block's type to Result<Unit> (Log.i returns Int)
        }.onFailure { Log.w(TAG, "sign-in failed", it) }

    suspend fun link(context: Context, otp: String): Result<Unit> = runCatching {
        val response = Network.api.linkDevice(
            LinkDeviceRequest(otp = otp.trim(), label = deviceLabel()),
        )
        Prefs.setLink(context, deviceSecret = response.deviceSecret, userId = response.userId)
        Network.deviceSecret = response.deviceSecret
        Log.i(TAG, "Device linked for user ${response.userId}")
        Unit
    }.onFailure { Log.w(TAG, "device link failed", it) }

    private const val TAG = "CostlyLink"
}
