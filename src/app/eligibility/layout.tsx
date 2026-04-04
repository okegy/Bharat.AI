import { VaultUnlockGate } from "@/components/formsaathi/VaultUnlockGate";

export default function EligibilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
