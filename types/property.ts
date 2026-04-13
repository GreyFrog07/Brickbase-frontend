// Property Category
export type PropertyCategory = 'Residential' | 'Commercial';

// Property Types
export type ResidentialPropertyType = 'Plot' | 'Builder Floor' | 'Villa/House' | 'Apartment Society';
export type CommercialPropertyType = 'Land/Plot Parcel' | 'SCO' | 'Working Space';
export type PropertyType = ResidentialPropertyType | CommercialPropertyType;

// Case Types
export type CaseType = 'REGISTRY_CASE' | 'TRANSFER_CASE' | 'RENTAL' | 'LEASE_HOLD' | 'OTHER';

// Age Type
export type AgeType = 'Fresh' | 'Resale' | 'UnderConstruction';

// Price Unit
export type PriceUnit = 'cr' | 'lakh' | 'lakh_per_month';

// Size Unit
export type SizeUnit = 'sq_ft' | 'sq_yards' | 'sq_mts';

export interface BuilderInfo {
  name?: string;
  phoneNumber?: string;
  countryCode?: string;
}

export interface FloorEntry {
  tower?: string;  // For Apartment Society
  floorNumber: number;
  price: number;
  priceUnit: PriceUnit;
  isSold?: boolean;
}

export interface SizeEntry {
  type: 'carpet' | 'builtup' | 'superbuiltup';
  value: number;
  unit: SizeUnit;
}

export interface AddressInfo {
  unitNo?: string;
  block?: string;
  sector?: string;
  area?: string;
  city?: string;
}

export interface ImportantFile {
  name: string;
  uri: string;
  base64?: string;
  mimeType?: string;
  path?: string;   // storage path (from server)
  url?: string;     // signed URL (from server)
  type?: string;    // file extension (from server)
}

export interface Property {
  id: string;
  propertyCategory?: PropertyCategory;
  propertyType?: PropertyType;
  propertyPhotos: string[];
  propertyVideos?: string[];
  coverPhotoIndex?: number;
  coverPhotoPath?: string;  // Raw storage path (no signed URL) for local-first caching
  floor?: number; // Legacy single floor
  floors?: FloorEntry[]; // New multiple floors
  price?: number;
  priceUnit?: PriceUnit;
  builderId?: string;
  builderName?: string;
  builderPhone?: string;
  builders?: BuilderInfo[];
  paymentPlan?: string;
  additionalNotes?: string;
  black?: number;
  white?: number;
  blackPercentage?: number;
  whitePercentage?: number;
  possessionMonth?: number;
  possessionYear?: number;
  possessionDate?: string; // Legacy
  userId?: string;
  userEmail?: string;
  clubProperty: boolean;
  poolProperty: boolean;
  parkProperty: boolean;
  gatedProperty: boolean;
  cornerProperty: boolean;
  propertyAge?: number;
  ageType?: AgeType;
  handoverDate?: string; // Legacy - will be removed
  case?: CaseType;
  latitude?: number;
  longitude?: number;
  sizes?: SizeEntry[];
  address?: AddressInfo;
  importantFiles?: ImportantFile[];
  bhk?: number;
  isSold?: boolean;
  orgId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Organization types ──────────────────────────────────────────────────

export interface OrganizationMember {
  id: string;
  userId: string;
  role: 'admin' | 'member';
  joinedAt?: string;
  name?: string;
  email?: string;
  phone?: string;
  profilePhotoUrl?: string;
}

export interface Organization {
  id: string;
  name: string;
  createdBy?: string;
  inviteCode?: string;
  createdAt?: string;
  updatedAt?: string;
  members: OrganizationMember[];
}

export interface Builder {
  id: string;
  name?: string;
  phoneNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Constants for dropdowns
export const RESIDENTIAL_PROPERTY_TYPES: ResidentialPropertyType[] = ['Plot', 'Builder Floor', 'Villa/House', 'Apartment Society'];
export const COMMERCIAL_PROPERTY_TYPES: CommercialPropertyType[] = ['Land/Plot Parcel', 'SCO', 'Working Space'];
export const CASE_TYPES: CaseType[] = ['REGISTRY_CASE', 'TRANSFER_CASE', 'RENTAL', 'LEASE_HOLD', 'OTHER'];
export const AGE_TYPES: AgeType[] = ['Fresh', 'Resale', 'UnderConstruction'];
export const SIZE_UNITS: { label: string; value: SizeUnit }[] = [
  { label: 'sq. ft.', value: 'sq_ft' },
  { label: 'sq. yards (gaj)', value: 'sq_yards' },
  { label: 'sq. mts.', value: 'sq_mts' },
];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
