import type { Metadata } from "next";
import { CreditLimitApp } from "../ClientOnly";

export const metadata: Metadata = { title: "Hạn mức" };

export default function Page() {
  return <CreditLimitApp />;
}
