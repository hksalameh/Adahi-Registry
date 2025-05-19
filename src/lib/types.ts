
// Firebase uses `uid` for user IDs.
export interface User {
  id: string; // Firebase UID
  username: string;
  email: string;
  // password?: string; // No longer storing password in client-side User object
  isAdmin: boolean;
}

export type DistributionPreference = 'ramtha' | 'gaza' | 'donor' | 'fund';

export interface AdahiSubmission {
  id: string; // Firestore document ID
  userId?: string; // Firebase UID of the user who submitted - now optional
  userEmail?: string; // For admin display convenience - now optional
  submitterUsername?: string; // Added for displaying username in admin table
  donorName: string;
  sacrificeFor: string;
  phoneNumber: string;
  wantsToAttend: boolean;
  wantsFromSacrifice: boolean;
  sacrificeWishes?: string;
  paymentConfirmed: boolean;
  receiptBookNumber?: string;
  voucherNumber?: string;
  throughIntermediary: boolean;
  intermediaryName?: string;
  distributionPreference: DistributionPreference;
  submissionDate: string; // Stored as ISO string. Firestore Timestamps will be converted.
  status: 'pending' | 'entered';
  lastUpdated: string; // Stored as ISO string
  lastUpdatedBy?: string; // Firebase UID of the user who last updated
  lastUpdatedByEmail?: string; // Email of the user who last updated
  isSlaughtered?: boolean; // To track slaughter status
  slaughterDate?: string; // To store the date of slaughter
  slaughterStatus?: 'pending' | 'marked_slaughtered' | 'confirmed_slaughtered' | 'notified'; // To track the detailed slaughter and notification status
}

export const distributionOptions: { value: DistributionPreference; label: string }[] = [
  { value: 'ramtha', label: 'لاهل الرمثا' },
  { value: 'gaza', label: 'لاهل غزة' },
  { value: 'donor', label: 'لنفس المتبرع' },
  { value: 'fund', label: 'لصندوق التكافل والتضامن' },
];
