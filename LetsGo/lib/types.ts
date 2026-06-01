export type UserRole = "rider" | "driver" | "admin";

export type DriverApprovalStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";

export type ride_type = "economy" | "comfort" | "premium" | "xl";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  /** Set by admin or trusted backend after SMS / phone ownership verification. */
  phone_verified_at?: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DriverRow = {
  id: string;
  approval_status: DriverApprovalStatus;
  stripe_connect_onboarded: boolean;
};

export type DriverDocumentType =
  | "license_front"
  | "license_back"
  | "vehicle_registration"
  | "insurance"
  | "vehicle_inspection"
  | "profile_photo"
  | "vehicle_photo"
  | "driver_selfie";
