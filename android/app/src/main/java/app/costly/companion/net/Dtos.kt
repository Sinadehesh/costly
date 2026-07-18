package app.costly.companion.net

/**
 * Wire models for the Costly Next.js API, serialized via Moshi's
 * KotlinJsonAdapterFactory (reflection — no codegen plugin needed).
 * Field names match the JSON the backend actually sends/receives — keep
 * them in lockstep with the route handlers in web/src/app/api.
 */

// ── Sessions ──────────────────────────────────────────────────────────────

data class StartSessionRequest(
    val userId: String,
    val appPackage: String,
)

data class StartSessionResponse(
    val sessionId: String,
    val resumed: Boolean = false,
)

data class HeartbeatRequest(
    val activeSecondsDelta: Int,
    val scrolledSinceLast: Boolean,
)

data class Taunt(
    val tierLevel: Int,
    val name: String,
    val priceCents: Int,
    val message: String,
)

data class HeartbeatResponse(
    val totalActiveSeconds: Int,
    val penaltyCents: Int,
    val capReached: Boolean,
    val taunts: List<Taunt> = emptyList(),
)

data class EndSessionResponse(
    val status: String,
    val totalPenaltyCents: Int = 0,
)

// ── Dead man's switch ─────────────────────────────────────────────────────

data class DeviceHeartbeatRequest(
    val userId: String,
    val accessibilityEnabled: Boolean? = null,
    val appVersion: String? = null,
)

data class ContractSummary(
    val id: String,
    val lockinEndsAt: String,
    val deletionFeeCents: Int,
)

data class AnchorLite(
    val name: String,
    val priceCents: Int,
    val tierLevel: Int,
)

data class DeviceHeartbeatResponse(
    val ok: Boolean,
    val contract: ContractSummary? = null,
    // Meter config for the live overlay — refreshed on every ping so the
    // bubble can tick euros and hostage-% locally, offline-tolerant.
    val penaltyRateCentsPerMin: Int? = null,
    val anchorItems: List<AnchorLite> = emptyList(),
)

// ── Redemption / sweat equity ─────────────────────────────────────────────

data class WalkingSyncRequest(
    // Cumulative verified walking minutes since session end. Cumulative (not a
    // delta) so retried syncs are harmless — the backend takes max().
    val completedWalkingMinutes: Int,
    val source: String = "health_connect",
)

data class WalkingSyncResponse(
    val status: String,
    val completedWalkingMinutes: Int? = null,
    val requiredWalkingMinutes: Int? = null,
    val changed: Boolean? = null,
)

// ── Dashboard (used to discover the pending redemption task) ───────────────

data class DashboardResponse(
    val holds: List<Hold> = emptyList(),
)

data class Hold(
    val sessionId: String,
    val endTime: String? = null,
    val redemption: Redemption? = null,
)

data class Redemption(
    val taskId: String,
    val requiredWalkingMinutes: Int,
    val completedWalkingMinutes: Int,
    val deadline: String,
    val status: String,
)
