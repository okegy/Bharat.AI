import { VaultUnlockGate } from "@/components/formsaathi/VaultUnlockGate";

export default function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
