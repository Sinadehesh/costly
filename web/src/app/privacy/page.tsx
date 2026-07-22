/**
 * Privacy policy — STUB / STARTER TEMPLATE.
 *
 * Google Play requires a live privacy-policy URL for any app requesting
 * Usage Access (and health data). This page gives that reachable URL
 * (${APP_BASE_URL}/privacy). It is a good-faith starting point describing what
 * Costly actually collects — it is NOT legal advice and MUST be reviewed by
 * counsel and adapted to your jurisdiction (GDPR/CCPA/etc.) before launch.
 */
export const metadata = {
  title: 'Costly — Privacy Policy',
};

const UPDATED = '2026-07-21';

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-zinc-950 px-6 py-12 text-zinc-300">
      <p className="font-mono text-xs tracking-[0.3em] text-emerald-400">COSTLY</p>
      <h1 className="mt-2 text-3xl font-extrabold text-white">Privacy Policy</h1>
      <p className="mt-1 text-sm text-zinc-500">Last updated: {UPDATED}</p>

      <div className="mt-6 rounded-lg border-2 border-yellow-600/50 bg-yellow-500/10 p-4 text-sm text-yellow-300">
        Template notice: this is a starter policy describing Costly&apos;s data
        practices. It is not legal advice — have it reviewed by counsel and
        localized before publishing to the Play Store.
      </div>

      <Section title="Who we are">
        Costly is a self-monitoring anti-doomscrolling tool. You set a per-minute
        rate and a step goal, and the app charges you when you exceed the first
        or miss the second. This policy explains what the Android companion app
        and our backend collect, why, and who it&apos;s shared with.
      </Section>

      <Section title="What we collect and why">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Foreground app (Usage Access).</strong> With your explicit
            permission, the app reads which application is currently in the
            foreground, solely to know when one of <em>your own</em> chosen
            blocked apps is open so the meter can run. We do not read the
            contents of any app.
          </li>
          <li>
            <strong>Device motion (gyroscope).</strong> Read only while a blocked
            app is open, to infer whether you are actively scrolling. Raw sensor
            data is processed on-device and is not transmitted.
          </li>
          <li>
            <strong>Step count (Health Connect).</strong> With your permission,
            we read your daily step total to evaluate the laziness penalty. Only
            the daily total and your timezone are sent to our backend — no other
            health data.
          </li>
          <li>
            <strong>Account &amp; billing data.</strong> Your email, chosen
            rate/goal, and the derived amounts you owe. Card details are handled
            entirely by Stripe; we never see or store your full card number.
          </li>
        </ul>
      </Section>

      <Section title="What we do NOT collect">
        We do not read the content of your apps, messages, or browsing. We do not
        collect location. We do not sell your data. Raw usage and sensor streams
        stay on your device — only the derived, agreed-upon billable amounts and
        daily step totals leave it.
      </Section>

      <Section title="Who we share with">
        <strong>Stripe</strong> processes all payments as our payment processor
        (see Stripe&apos;s privacy policy). We share data with service providers
        only as needed to run the service, and when required by law.
      </Section>

      <Section title="Your choices">
        You can revoke Usage Access, Health Connect, or overlay permissions at any
        time in Android Settings; the corresponding features stop. You can request
        access to or deletion of your account data by contacting us below.
      </Section>

      <Section title="Contact">
        Questions or data requests: <em>privacy@your-domain.example</em> (replace
        with your real contact before launch).
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
