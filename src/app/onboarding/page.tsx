import { OnboardingFlowGate } from "@/components/formsaathi/OnboardingFlowGate";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <OnboardingFlowGate />
  );
}
