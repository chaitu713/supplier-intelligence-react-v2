import type { ComponentType } from "react";

import OnboardingPage from "./OnboardingPage.jsx";

export function OnboardingPageWrapper() {
  const OnboardingPageComponent = OnboardingPage as unknown as ComponentType;
  return <OnboardingPageComponent />;
}
