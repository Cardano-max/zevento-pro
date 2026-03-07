export interface VendorScoreFactors {
  vendorId: string;
  subscriptionTier: string; // 'BASIC' | 'PREMIUM'
  averageRating: number; // 0-5
  responseRate: number; // 0-1
  locationMatch: boolean;
  fairnessCount: number; // leads in current rotation window
}
