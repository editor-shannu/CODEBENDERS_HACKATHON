import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Baaki" };

export default function Page() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="23 November 2026"
      sections={[
        { h: "What Baaki is", p: ["Baaki helps home tutors track fees, families and payments. This policy covers the Baaki web app and the Munshi WhatsApp assistant."] },
        { h: "What we collect", p: ["Your Google account name and email when you sign in.", "The student, family, fee and payment records you enter or import.", "If you message Munshi on WhatsApp: your WhatsApp phone number and the text of your messages, used only to answer you."] },
        { h: "How we use it", p: ["Only to run Baaki for you: show balances, reminders, forecasts and answer your questions. We do not sell your data or use it for advertising.", "Messages may be processed by our AI provider to generate replies. Payments are handled by Razorpay; we never see your card or UPI details."] },
        { h: "Demo mode", p: ["The public demo stores nothing past your browser session; demo data is deleted automatically."] },
        { h: "Your choices", p: ["You can ask us to delete your account and all your data at any time. See the Data Deletion page."] },
        { h: "Contact", p: ["Questions: open an issue at github.com/editor-shannu/CODEBENDERS_HACKATHON."] },
      ]}
    />
  );
}
