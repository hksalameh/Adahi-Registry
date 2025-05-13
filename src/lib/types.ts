
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
  userId: string; // Firebase UID of the user who submitted
  userEmail?: string; // For admin display convenience
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
}

export const distributionOptions: { value: DistributionPreference; label: string }[] = [
  { value: 'ramtha', label: 'لاهل الرمثا' },
  { value: 'gaza', label: 'لاهل غزة' },
  { value: 'donor', label: 'لنفس المتبرع' },
  { value: 'fund', label: 'لصندوق التكافل والتضامن' },
];
