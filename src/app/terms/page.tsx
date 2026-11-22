import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · Baaki" };

export default function Page() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="23 November 2026"
      sections={[
        { h: "Using Baaki", p: ["Baaki is a fee-tracking tool for tutors. By using it you agree to these terms. You are responsible for the records you enter and for messages you send to families."] },
        { h: "Munshi", p: ["Munshi is an AI assistant. Its answers and forecasts can be wrong; check important figures before acting on them."] },
        { h: "Payments", p: ["Paid plans are billed through Razorpay and can be cancelled any time. Test-mode checkout charges nothing."] },
        { h: "No warranty", p: ["Baaki is provided as is, without warranty of any kind, to the extent the law allows."] },
        { h: "Changes", p: ["We may update these terms; the date above shows the latest version."] },
      ]}
    />
  );
}
