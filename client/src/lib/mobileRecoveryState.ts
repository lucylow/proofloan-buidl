export type MobileActionAvailabilityInput = {
  isOnline: boolean;
  proofPending: boolean;
  refreshPending: boolean;
  acceptPending: boolean;
};

export function getMobileActionAvailability({ isOnline, proofPending, refreshPending, acceptPending }: MobileActionAvailabilityInput) {
  return {
    canSubmitProof: isOnline && !proofPending,
    canRefresh: isOnline && !refreshPending,
    canAccept: isOnline && !acceptPending,
  };
}
