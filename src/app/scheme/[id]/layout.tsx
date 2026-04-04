import { VaultUnlockGate } from "@/components/formsaathi/VaultUnlockGate";

export default function SchemeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
