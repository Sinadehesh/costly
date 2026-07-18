package app.costly.companion.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/** Hostile notifications. The villain speaks through these. */
object Notifier {

    private const val CHANNEL_TAUNTS = "costly-taunts"
    private var nextId = 1000

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_TAUNTS,
                "Costly taunts",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Fires when your meter buys us one of your own wishlist items."
            },
        )
    }

    fun taunt(context: Context, title: String, message: String) {
        ensureChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL_TAUNTS)
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        runCatching {
            // POST_NOTIFICATIONS may be denied; the meter still bills either way.
            NotificationManagerCompat.from(context).notify(nextId++, notification)
        }
    }
}
