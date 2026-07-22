package app.costly.companion.net

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface CostlyApi {

    /** Device linking — exchanges the dashboard OTP for a per-device secret. */
    @POST("api/device/link")
    suspend fun linkDevice(@Body body: LinkDeviceRequest): LinkDeviceResponse

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

    @GET("api/dashboard")
    suspend fun dashboard(@Query("userId") userId: String): DashboardResponse

    @POST("api/redemptions/{taskId}/sync")
    suspend fun syncWalking(
        @Path("taskId") taskId: String,
        @Body body: WalkingSyncRequest,
    ): WalkingSyncResponse
}
