package app.costly.companion.net

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path

interface CostlyApi {

    /**
     * Ordinary email + password sign-in. Returns a per-device secret, so the
     * password is used once and never stored on the device.
     */
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    /**
     * Google Sign-In. The device sends a Credential Manager ID token; the
     * server verifies it against Google's keys and returns a device secret.
     */
    @POST("api/auth/google")
    suspend fun googleLogin(@Body body: GoogleLoginRequest): LoginResponse

    /**
     * Legacy OTP pairing. Superseded by login() — kept because a device linked
     * under the old flow still holds a valid secret, and removing the endpoint
     * from the client would strand anyone mid-migration.
     */
    @POST("api/device/link")
    suspend fun linkDevice(@Body body: LinkDeviceRequest): LinkDeviceResponse

    /**
     * Submit the contract. Session-authenticated (Bearer), not device — the
     * device secret does not exist yet at this point in the flow.
     */
    @POST("api/onboarding")
    suspend fun onboard(
        @Header("Authorization") bearer: String,
        @Body body: OnboardingRequest,
    ): OnboardingResponse

    /** Client secret for saving a card off-session. */
    @POST("api/stripe/setup-intent")
    suspend fun setupIntent(@Header("Authorization") bearer: String): SetupIntentResponse

    @POST("api/sessions/start")
    suspend fun startSession(@Body body: StartSessionRequest): StartSessionResponse

    @POST("api/sessions/{sessionId}/heartbeat")
    suspend fun sessionHeartbeat(
        @Path("sessionId") sessionId: String,
        @Body body: HeartbeatRequest,
    ): HeartbeatResponse

    @POST("api/sessions/{sessionId}/end")
    suspend fun endSession(@Path("sessionId") sessionId: String): EndSessionResponse

    @POST("api/device/heartbeat")
    suspend fun deviceHeartbeat(@Body body: DeviceHeartbeatRequest): DeviceHeartbeatResponse

    @POST("api/device/steps")
    suspend fun syncSteps(@Body body: StepsSyncRequest): StepsSyncResponse

    /** Settle Up: mint a Stripe Checkout Session (device-authed, no body). */
    @POST("api/stripe/create-checkout")
    suspend fun createCheckout(): CreateCheckoutResponse

    /** The user is derived from x-device-secret — no userId is sent. */
    @GET("api/dashboard")
    suspend fun dashboard(): DashboardResponse

    @POST("api/redemptions/{taskId}/sync")
    suspend fun syncWalking(
        @Path("taskId") taskId: String,
        @Body body: WalkingSyncRequest,
    ): WalkingSyncResponse
}
