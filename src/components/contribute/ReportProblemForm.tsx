"use client";

import type { ComponentProps } from "react";
import { ContributeForm } from "./ContributeForm";
import { useAccountSession } from "@/src/features/account/AccountSessionProvider";

export function ReportProblemForm(props: Omit<ComponentProps<typeof ContributeForm>, "kind" | "signedIn">) {
  const { session } = useAccountSession();
  const signedIn = session.status === "signed-in" ? "yes" : session.status === "signed-out" ? "no" : "unknown";
  return <ContributeForm {...props} kind="bug" signedIn={signedIn} />;
}
