import { VaultUnlockGate } from "@/components/BharatLink/VaultUnlockGate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultUnlockGate>{children}</VaultUnlockGate>;
}
