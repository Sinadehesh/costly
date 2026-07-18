package app.costly.companion.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.compose.ui.platform.ComposeView
import app.costly.companion.R
import kotlin.math.abs

/**
 * THE LIVE METER OVERLAY.
 *
 * A foreground service that hosts a Jetpack Compose bubble in a
 * TYPE_APPLICATION_OVERLAY window drawn over the foregrounded vice app.
 * Started/stopped by the spy as sessions begin and end.
 *
 * Android 15+ requires SYSTEM_ALERT_WINDOW overlays that persist across app
 * switches to be backed by a foreground service with an ongoing notification —
 * so we run FOREGROUND_SERVICE_SPECIAL_USE with "Costly Meter is Active".
 *
 * The window itself never re-derives billable time; the Compose content
 * observes MeterBus and ticks locally. This service only owns the window: its
 * lifecycle, placement, and drag-to-move.
 */
class CostlyOverlayService : Service() {

    private lateinit var windowManager: WindowManager
    private var bubble: View? = null
    private var owner: OverlayLifecycleOwner? = null
    private lateinit var params: WindowManager.LayoutParams

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        startAsForeground()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // The permission can be revoked between the spy's check and here — bail
        // cleanly rather than throwing a BadTokenException at addView.
        if (!Settings.canDrawOverlays(this)) {
            Log.w(TAG, "overlay permission missing — stopping")
            stopSelf()
            return START_NOT_STICKY
        }
        if (bubble == null) attachBubble()
        return START_STICKY
    }

    private fun attachBubble() {
        val lifecycleOwner = OverlayLifecycleOwner().apply { onCreate(); onResume() }
        owner = lifecycleOwner

        val view = ComposeView(this).apply {
            lifecycleOwner.attachTo(this)
            setContent { MeterOverlay() }
        }

        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 24
            y = 240
        }

        attachDragHandler(view)
        windowManager.addView(view, params)
        bubble = view
    }

    /**
     * Drag-to-move. The window is FLAG_NOT_FOCUSABLE so it never steals input
     * from the app underneath; we only consume touches that land on the bubble
     * itself, and treat a small movement as a tap (future: expand the pill).
     */
    private fun attachDragHandler(view: View) {
        var initialX = 0
        var initialY = 0
        var touchX = 0f
        var touchY = 0f

        view.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    touchX = event.rawX
                    touchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x = initialX + (event.rawX - touchX).toInt()
                    params.y = initialY + (event.rawY - touchY).toInt()
                    windowManager.updateViewLayout(view, params)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    val moved = abs(event.rawX - touchX) + abs(event.rawY - touchY)
                    if (moved < TAP_SLOP) v.performClick()
                    true
                }
                else -> false
            }
        }
    }

    private fun startAsForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "Costly Meter", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Shown while the live meter is running over a blocked app."
                setShowBadge(false)
            },
        )
        val notification: Notification = Notification.Builder(this, CHANNEL)
            .setContentTitle("Costly Meter is Active")
            .setContentText("The meter is running. Every second is billable.")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(
                NOTIF_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    override fun onDestroy() {
        bubble?.let { runCatching { windowManager.removeView(it) } }
        bubble = null
        owner?.onDestroy()
        owner = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "CostlyOverlay"
        private const val CHANNEL = "costly-meter"
        private const val NOTIF_ID = 7001
        private const val TAP_SLOP = 24f

        /**
         * Starting an FGS from the spy's background context is restricted on
         * Android 12+, but holding SYSTEM_ALERT_WINDOW is an explicit exemption
         * — which is exactly why the spy only calls this after canDrawOverlays.
         * Still wrapped defensively so an OEM edge case degrades to "no bubble"
         * rather than crashing the meter.
         */
        fun start(context: Context) {
            val intent = Intent(context, CostlyOverlayService::class.java)
            runCatching { context.startForegroundService(intent) }
                .onFailure { Log.w(TAG, "overlay FGS start refused", it) }
        }

        fun stop(context: Context) {
            runCatching { context.stopService(Intent(context, CostlyOverlayService::class.java)) }
        }
    }
}
