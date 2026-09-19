export type AppRole = "administrator" | "analyst" | "commercial_partner" | "technical_partner";
export type Permission = "run_import" | "activate_model" | "view_markets" | "review_company" | "view_prospects" | "manage_prospects";

const permissions: Record<AppRole, readonly Permission[]> = {
  administrator: ["run_import", "activate_model", "view_markets", "review_company", "view_prospects", "manage_prospects"],
  analyst: ["run_import", "view_markets", "review_company", "view_prospects", "manage_prospects"],
  commercial_partner: ["view_markets", "review_company"],
  technical_partner: ["view_markets", "review_company"]
};

export function hasPermission(role: AppRole, permission: Permission): boolean {
  return permissions[role].includes(permission);
}

export function canPublishDataset(input: { licenseReviewStatus: "pending" | "approved" | "rejected"; qualityStatus: "pending" | "passed" | "failed" }): boolean {
  return input.licenseReviewStatus === "approved" && input.qualityStatus === "passed";
}
