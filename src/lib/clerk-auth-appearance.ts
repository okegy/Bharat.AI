/** Puts social sign-in (e.g. Google) before email so the flow is clearly “Google first”. */
export const formSaathiClerkAppearance = {
  layout: {
    socialButtonsVariant: "blockButton" as const,
    socialButtonsPlacement: "top" as const,
  },
};
