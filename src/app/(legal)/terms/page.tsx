import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — HENRYHUB.ai",
  description: "Terms of Service for HENRYHUB.ai, a product of Alconbury Tech Ltd.",
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

export default function TermsOfService() {
  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <span>Terms of Service</span>
        <span className="ml-auto text-terminal-muted font-normal text-[9px]">
          Last updated: March 2026
        </span>
      </div>

      <div className="p-4 space-y-1">
        <p className="text-[12px] text-terminal-muted mb-6">
          These Terms of Service (&quot;Terms&quot;) govern your use of HENRYHUB.ai (the &quot;Service&quot;),
          operated by Alconbury Tech Ltd (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By accessing or using the
          Service, you agree to be bound by these Terms.
        </p>

        <Section title="1. Acceptance of Terms">
          <p>
            By creating an account or using the Service, you confirm that you are at least 18 years
            old and agree to comply with these Terms. If you do not agree, you must not use the Service.
          </p>
        </Section>

        <Section title="2. Service Description">
          <p>
            HENRYHUB.ai provides AI-powered analysis and information related to Henry Hub natural
            gas markets. The Service includes a chat interface, price data visualisation, and
            related tools. The Service is provided for informational purposes only.
          </p>
          <p>
            We reserve the right to modify, suspend, or discontinue any part of the Service at
            any time, with or without notice.
          </p>
        </Section>

        <Section title="3. User Accounts">
          <p>
            To access certain features, you must create an account. You are responsible for
            maintaining the confidentiality of your account credentials and for all activity
            that occurs under your account. You agree to provide accurate information and to
            notify us immediately of any unauthorised use.
          </p>
          <p>
            We reserve the right to suspend or terminate accounts that violate these Terms or
            that we reasonably believe to be engaged in fraudulent or abusive activity.
          </p>
        </Section>

        <Section title="4. Acceptable Use">
          <p>You agree not to:</p>
          <ul className="list-none space-y-1 pl-3">
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Use the Service for any unlawful purpose</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Attempt to gain unauthorised access to the Service or its systems</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Interfere with or disrupt the integrity or performance of the Service</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Reverse-engineer, decompile, or disassemble any part of the Service</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Use automated systems or bots to access the Service without permission</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Resell, redistribute, or commercially exploit the Service or its data without authorisation</li>
            <li className="before:content-['—'] before:mr-2 before:text-terminal-green/60">Use the Service to generate or distribute misleading financial advice</li>
          </ul>
        </Section>

        <Section title="5. Intellectual Property">
          <p>
            All content, design, code, and materials on HENRYHUB.ai are the property of
            Alconbury Tech Ltd or its licensors and are protected by applicable intellectual
            property laws. You may not copy, modify, distribute, or create derivative works
            from any part of the Service without our prior written consent.
          </p>
          <p>
            You retain ownership of any content you submit through the Service, but grant us
            a non-exclusive licence to store and process it as necessary to provide the Service.
          </p>
        </Section>

        <Section title="6. Financial Disclaimer">
          <p>
            The Service does not provide financial, investment, or trading advice. All information,
            analysis, and data presented through the Service are for informational and educational
            purposes only. You should not make financial decisions based solely on information
            obtained through the Service. Always consult a qualified financial adviser before
            making investment decisions. See our Disclaimer page for further details.
          </p>
        </Section>

        <Section title="7. Limitation of Liability">
          <p>
            To the fullest extent permitted by law, Alconbury Tech Ltd shall not be liable for
            any indirect, incidental, special, consequential, or punitive damages, or any loss
            of profits, data, or goodwill arising out of or in connection with your use of the
            Service.
          </p>
          <p>
            Our total liability to you for all claims arising from or relating to the Service
            shall not exceed the amount you have paid us in the twelve (12) months preceding the
            claim, or fifty pounds sterling (£50), whichever is greater.
          </p>
        </Section>

        <Section title="8. Indemnification">
          <p>
            You agree to indemnify and hold harmless Alconbury Tech Ltd, its directors, officers,
            and employees from any claims, damages, losses, or expenses (including reasonable legal
            fees) arising from your use of the Service or violation of these Terms.
          </p>
        </Section>

        <Section title="9. Termination">
          <p>
            We may suspend or terminate your access to the Service at any time, for any reason,
            without prior notice. Upon termination, your right to use the Service ceases
            immediately. Provisions that by their nature should survive termination will remain
            in effect.
          </p>
          <p>
            You may close your account at any time by contacting us. Upon account closure,
            we will delete your personal data in accordance with our Privacy Policy.
          </p>
        </Section>

        <Section title="10. Modifications to Terms">
          <p>
            We may revise these Terms at any time by posting an updated version on this page.
            Material changes will be indicated by updating the &quot;Last updated&quot; date. Your continued
            use of the Service after changes are posted constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="11. Governing Law">
          <p>
            These Terms are governed by and construed in accordance with the laws of England
            and Wales. Any disputes arising from these Terms or your use of the Service shall
            be subject to the exclusive jurisdiction of the courts of England and Wales.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            For questions about these Terms, please contact us:
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
