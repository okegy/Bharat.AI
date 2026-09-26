import { VaultUnlockGate } from "@/components/BharatLink/VaultUnlockGate";

export default function FormFillLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
