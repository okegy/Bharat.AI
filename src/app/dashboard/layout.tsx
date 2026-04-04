import { VaultUnlockGate } from "@/components/formsaathi/VaultUnlockGate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
