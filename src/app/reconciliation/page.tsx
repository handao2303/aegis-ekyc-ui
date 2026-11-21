import type { Metadata } from "next";
import { ReconciliationApp } from "../ClientOnly";

export const metadata: Metadata = { title: "Đối soát" };

export default function Page() {
  return <ReconciliationApp />;
}
