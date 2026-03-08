import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer — HENRYHUB.ai",
  description: "Disclaimer for HENRYHUB.ai, a product of Alconbury Tech Ltd.",
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

export default function Disclaimer() {
  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <span>Disclaimer</span>
        <span className="ml-auto text-terminal-muted font-normal text-[9px]">
          Last updated: March 2026
        </span>
      </div>

      <div className="p-4 space-y-1">
        <p className="text-[12px] text-terminal-muted mb-6">
          Please read this Disclaimer carefully before using HENRYHUB.ai (the &quot;Service&quot;),
          operated by Alconbury Tech Ltd (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
        </p>

        <Section title="1. General Disclaimer">
          <p>
            The information provided by the Service is for general informational and educational
            purposes only. While we strive to keep the information accurate and up to date, we
            make no representations or warranties of any kind, express or implied, about the
            completeness, accuracy, reliability, suitability, or availability of the Service or
            the information it provides.
          </p>
        </Section>

        <Section title="2. Not Financial Advice">
          <p className="text-white font-semibold">
            HENRYHUB.ai does not provide financial, investment, or trading advice.
          </p>
          <p>
            Nothing on this Service constitutes a recommendation to buy, sell, or hold any
            commodity, security, or financial instrument. Natural gas markets carry significant
            risk, and past performance is not indicative of future results. Any reliance you
            place on information obtained through the Service is strictly at your own risk.
          </p>
          <p>
            You should always conduct your own research and consult with a qualified financial
            adviser before making any investment or trading decisions.
          </p>
        </Section>

        <Section title="3. Data Accuracy">
          <p>
            Price data, market information, and other data displayed on the Service are sourced
            from third-party providers and publicly available sources. This data may be delayed,
            incomplete, or inaccurate. We do not guarantee the accuracy, timeliness, or
            completeness of any data presented.
          </p>
          <p>
            Real-time or near-real-time data, where available, should not be relied upon for
            time-sensitive trading decisions. Always verify data with authoritative sources
            before acting on it.
          </p>
        </Section>

        <Section title="4. AI-Generated Content">
          <p>
            The Service uses artificial intelligence to generate analysis, summaries, and
            responses. AI-generated content may contain errors, inaccuracies, or outdated
            information. AI outputs should be treated as a starting point for further research,
            not as definitive analysis or advice.
          </p>
          <p>
            We do not guarantee that AI-generated content is free from bias, error, or
            hallucination. Always verify important information independently.
          </p>
        </Section>

        <Section title="5. Third-Party Data and Services">
          <p>
            The Service incorporates data and functionality from third-party providers. We are
            not responsible for the accuracy, availability, or reliability of third-party data
            or services. The inclusion of third-party data does not imply endorsement of or
            affiliation with those providers.
          </p>
          <p>
            Links or references to external sources are provided for convenience only. We do
            not control and are not responsible for the content or practices of any external sites.
          </p>
        </Section>

        <Section title="6. No Warranties">
          <p>
            The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties
            of any kind, whether express, implied, or statutory, including but not limited to
            implied warranties of merchantability, fitness for a particular purpose, and
            non-infringement.
          </p>
          <p>
            We do not warrant that the Service will be uninterrupted, error-free, secure, or
            free of harmful components. We do not warrant that the results obtained from the
            Service will be accurate or reliable.
          </p>
        </Section>

        <Section title="7. Limitation of Liability">
          <p>
            To the fullest extent permitted by applicable law, Alconbury Tech Ltd and its
            directors, officers, employees, and agents shall not be liable for any direct,
            indirect, incidental, special, consequential, or punitive damages arising from
            or related to your use of, or inability to use, the Service, including but not
            limited to damages for loss of profits, trading losses, data loss, or other
            intangible losses.
          </p>
        </Section>

        <Section title="8. Regulatory Compliance">
          <p>
            HENRYHUB.ai is not a regulated financial services provider. We are not registered
            with or regulated by any financial regulatory authority. The Service does not
            constitute a regulated activity under the laws of any jurisdiction.
          </p>
          <p>
            Users are responsible for ensuring their use of the Service complies with all
            applicable laws and regulations in their jurisdiction.
          </p>
        </Section>

        <Section title="9. Changes to This Disclaimer">
          <p>
            We reserve the right to update or modify this Disclaimer at any time. Changes will
            be effective upon posting to this page with a revised &quot;Last updated&quot; date. Your
            continued use of the Service constitutes acceptance of the updated Disclaimer.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            If you have questions about this Disclaimer, please contact us:
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
