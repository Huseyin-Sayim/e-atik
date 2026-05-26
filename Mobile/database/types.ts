export interface Address {
  city?: string;
  district?: string;
}

export interface Contact {
  phone?: string;
}

export interface CorpInfo {
  name?: string;
  surname?: string;
}

export interface CorpContact {
  phone?: string;
}

export interface CorpAddress {
  city?: string;
  district?: string;
}

export interface User {
  fullName?: string;
  name?: string;
  surname?: string;
  city?: string;
  district?: string;
  email: string;
  password?: string;
  isFirstLogin?: boolean;
  profileType?: 'kisisel' | 'kurumsal';
  createdAt?: number;
  region?: {
    id: string;
    name: string;
    region_id: string;
  };
  avatar?: string;
  profileImage?: string;
  phone?: string;
  role?: string;
  coins?: number;
  theme?: string;
  address?: Address;
  contact?: Contact;
  corpInfo?: CorpInfo;
  corpContact?: CorpContact;
  corpAddress?: CorpAddress;
}

export interface DatabaseState {
  users: User[];
}
