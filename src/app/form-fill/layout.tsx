import { VaultUnlockGate } from "@/components/formsaathi/VaultUnlockGate";

export default function FormFillLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
