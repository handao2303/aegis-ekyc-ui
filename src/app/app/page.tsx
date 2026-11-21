import type { Metadata } from "next";
import { CustomerApp } from "../ClientOnly";

export const metadata: Metadata = { title: "Mở tài khoản" };

export default function Page() {
  return <CustomerApp />;
}
