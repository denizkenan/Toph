export interface PermissionManager {
  inspectRequiredPermissions: () => Promise<void>;
}

export function createPermissionManager(): PermissionManager {
  return {
    async inspectRequiredPermissions() {
      // Permission checks and onboarding are intentionally deferred to Phase 3.
    },
  };
}
