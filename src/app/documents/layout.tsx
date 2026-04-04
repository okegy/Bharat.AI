import { VaultUnlockGate } from "@/components/formsaathi/VaultUnlockGate";

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
