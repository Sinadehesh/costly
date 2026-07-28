/**
 * Outbound user notifications.
 *
 * There is deliberately no mail-provider SDK wired in here. The one message
 * this system genuinely must send — "your phone has gone quiet and you're
 * about to be charged" — goes out precisely when the DEVICE is unreachable,
 * so it cannot be a push notification; it has to be email.
 *
 * Rather than hardcode a provider, this posts to NOTIFY_WEBHOOK_URL (point it
 * at Resend/Postmark/SendGrid, an n8n-free serverless function, or anything
 * that speaks HTTP). With nothing configured it logs loudly and reports
 * failure, so the caller records that the warning did NOT go out and retries
 * on the next sweep instead of silently marking it sent.
 *
 * BEFORE REAL CARDS: configure a provider. An unsent warning means the first
 * thing a user with a flat battery hears about the deletion fee is the charge
 * itself — which is exactly the chargeback this rail exists to prevent.
 */

export interface NotificationPayload {
  to: string;
  subject: string;
  body: string;
  kind: string;
}

export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  const endpoint = process.env.NOTIFY_WEBHOOK_URL;

  if (!endpoint) {
    console.warn(
      `[notify] NOTIFY_WEBHOOK_URL unset — "${payload.kind}" to ${payload.to} was NOT sent. ` +
        `Subject: ${payload.subject}`,
    );
    return false;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NOTIFY_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.NOTIFY_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[notify] ${payload.kind} to ${payload.to} failed: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[notify] ${payload.kind} to ${payload.to} threw`, err);
    return false;
  }
}

/** The 18h "your phone went quiet" warning, before the switch fires. */
export function heartbeatWarning(
  to: string,
  deletionFeeCents: number,
  hoursLeft: number,
): NotificationPayload {
  const fee = (deletionFeeCents / 100).toFixed(2);
  return {
    to,
    kind: 'heartbeat_warning',
    subject: 'Costly: your phone has gone quiet',
    body:
      `The companion app hasn't checked in for a while. If it stays silent for ` +
      `another ${hoursLeft} hours or so, the contract treats that as deletion and ` +
      `charges the €${fee} breach fee.\n\n` +
      `If your phone was just off or out of signal, open the app once and this ` +
      `resolves itself — no charge, nothing to do.\n\n` +
      `If you did uninstall it: reinstalling and opening it before the deadline ` +
      `still cancels the fee.`,
  };
}
