package app.costly.companion.net

import android.content.Context
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import app.costly.companion.BuildConfig
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * Google Sign-In through Credential Manager.
 *
 * This shows the system account sheet inside the app: no browser, no redirect,
 * and no step that sends the user to a website to finish signing in. What comes
 * back is a Google ID token, which the backend verifies against Google's public
 * keys before it will issue a device secret.
 *
 * Requesting the WEB client id is not a mistake. The ID token's audience has to
 * match what the server checks, and the server checks the web client id.
 */
object GoogleAuth {

    val isConfigured: Boolean get() = BuildConfig.GOOGLE_WEB_CLIENT_ID.isNotBlank()

    /** Returns a verified Google ID token, or fails with the reason. */
    suspend fun idToken(context: Context): Result<String> = runCatching {
        check(isConfigured) {
            "GOOGLE_WEB_CLIENT_ID is empty: build with -PcostlyGoogleWebClientId=..."
        }

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(
                GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID).build(),
            )
            .build()

        val response = CredentialManager.create(context).getCredential(context, request)
        val credential = response.credential

        // Credential Manager is generic, so the Google type has to be asserted
        // rather than assumed: anything else here means a misconfigured request.
        if (credential !is CustomCredential ||
            credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            error("unexpected credential type: ${credential.type}")
        }

        GoogleIdTokenCredential.createFrom(credential.data).idToken
    }.onFailure { Log.w(TAG, "google sign-in failed", it) }

    private const val TAG = "CostlyGoogle"
}
