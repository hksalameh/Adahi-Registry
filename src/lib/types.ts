
export interface User {
  id: string;
  username: string;
  email: string;
  password?: string; // Only for registration/mock storage, not for client state
  isAdmin: boolean;
}

export type DistributionPreference = 'ramtha' | 'gaza' | 'donor' | 'fund';

export interface AdahiSubmission {
  id: string;
  userId: string;
  userEmail?: string; // For admin display
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
  submissionDate: string; // ISO string date
  status: 'pending' | 'entered'; // pending = غير مدخلة, entered = مدخلة
}

export const distributionOptions: { value: DistributionPreference; label: string }[] = [
  { value: 'ramtha', label: 'لاهل الرمثا' },
  { value: 'gaza', label: 'لاهل غزة' },
  { value: 'donor', label: 'لنفس المتبرع' },
  { value: 'fund', label: 'لصندوق التكافل والتضامن' },
];
