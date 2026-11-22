import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Data Deletion · Baaki" };

export default function Page() {
  return (
    <LegalPage
      title="Delete your data"
      updated="23 November 2026"
      sections={[
        { h: "How to request deletion", p: ["Open an issue at github.com/editor-shannu/CODEBENDERS_HACKATHON titled \"Delete my data\" with the Google email you signed in with."] },
        { h: "What gets deleted", p: ["Your account, all students, families, fees, payments and invoices, Munshi chat history, and the link between your WhatsApp number and your account. Deletion is completed within 7 days."] },
        { h: "Demo users", p: ["Demo data is never kept: it is removed automatically when the session ends."] },
      ]}
    />
  );
}
