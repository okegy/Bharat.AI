import { VaultUnlockGate } from "@/components/BharatLink/VaultUnlockGate";

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
