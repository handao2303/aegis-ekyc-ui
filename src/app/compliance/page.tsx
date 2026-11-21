import type { Metadata } from "next";
import { ComplianceApp } from "../ClientOnly";

export const metadata: Metadata = { title: "Compliance" };

export default function Page() {
  return <ComplianceApp />;
}
