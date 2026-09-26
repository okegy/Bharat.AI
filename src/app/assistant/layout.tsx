import { VaultUnlockGate } from "@/components/BharatLink/VaultUnlockGate";

export default function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
