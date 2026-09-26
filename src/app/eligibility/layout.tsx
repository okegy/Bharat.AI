import { VaultUnlockGate } from "@/components/BharatLink/VaultUnlockGate";

export default function EligibilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
