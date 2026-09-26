import { VaultUnlockGate } from "@/components/BharatLink/VaultUnlockGate";

export default function SchemeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
