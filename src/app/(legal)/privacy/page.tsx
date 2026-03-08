import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — HENRYHUB.ai",
  description: "Privacy Policy for HENRYHUB.ai, a product of Alconbury Tech Ltd.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white mb-2">
        {title}
      </h2>
      <div className="text-[12px] text-terminal-text leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <span>Privacy Policy</span>
        <span className="ml-auto text-terminal-muted font-normal text-[9px]">
          Last updated: March 2026
        </span>
      </div>

      <div className="p-4 space-y-1">
        <p className="text-[12px] text-terminal-muted mb-6">
          This Privacy Policy explains how Alconbury Tech Ltd (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;)
          collects, uses, and protects your information when you use HENRYHUB.ai (the &quot;Service&quot;).
        </p>

        <Section title="1. Information We Collect">
          <p>
            <span className="text-white font-semibold">Account Information:</span> When you create an
            account, we collect your email address, display name, and a securely hashed version of your
            password. We never store passwords in plain text.
          </p>
          <p>
            <span className="text-white font-semibold">Usage Data:</span> We collect anonymous usage
            data to improve the Service, including pages visited, features used, and general interaction
            patterns. This data is collected without the use of cookies or third-party tracking scripts.
          </p>
          <p>
            <span className="text-white font-semibold">Conversation Data:</span> Messages you send
            through the chat interface are stored to provide conversation history and improve
            the Service. Your conversations are private and not shared with other users.
          </p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul className="list-none space-y-1 pl-3">
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Provide, maintain, and improve the Service</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Authenticate your account and manage sessions</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Analyse usage patterns to enhance user experience</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Respond to your enquiries and provide support</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="3. Data Storage and Security">
          <p>
            Your data is stored on secure, managed database infrastructure provided by third-party
            hosting services. We implement industry-standard security measures including encrypted
            connections, secure password hashing, and session-based authentication to protect your data.
          </p>
          <p>
            While we strive to protect your information, no method of electronic storage or
            transmission over the internet is 100% secure. We cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="4. Third-Party Services">
          <p>
            We use third-party service providers for hosting, data storage, AI processing, and
            analytics. These providers may process your data on our behalf and are contractually
            obligated to protect your information. We do not sell, rent, or trade your personal
            information to third parties.
          </p>
        </Section>

        <Section title="5. Cookies">
          <p>
            HENRYHUB.ai does not use cookies for tracking or advertising purposes. We use a
            session-based authentication mechanism that stores a minimal session identifier to
            keep you signed in. No third-party tracking cookies are placed on your device.
          </p>
        </Section>

        <Section title="6. Data Retention">
          <p>
            We retain your account data and conversation history for as long as your account is
            active. You may request deletion of your account and associated data at any time by
            contacting us. Anonymous usage data may be retained in aggregated form for analytical
            purposes.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>
            Depending on your jurisdiction, you may have the right to:
          </p>
          <ul className="list-none space-y-1 pl-3">
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Access the personal data we hold about you</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Request correction of inaccurate data</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Request deletion of your data</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Object to or restrict processing of your data</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Request portability of your data</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us at the address below.
          </p>
        </Section>

        <Section title="8. Children">
          <p>
            The Service is not intended for use by individuals under the age of 18. We do not
            knowingly collect personal information from children. If you believe a child has
            provided us with personal data, please contact us so we can take appropriate action.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any material
            changes by posting the updated policy on this page with a revised &quot;Last updated&quot; date.
            Your continued use of the Service after changes are posted constitutes acceptance of the
            updated policy.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            If you have questions about this Privacy Policy or wish to exercise your data rights,
            please contact us:
          </p>
          <p className="text-terminal-muted mt-1">
            Alconbury Tech Ltd<br />
            Email: legal@henryhub.ai
          </p>
        </Section>
      </div>
    </div>
  );
}
