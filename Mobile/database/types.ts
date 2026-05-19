export interface User {
  fullName?: string;
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
}

export interface DatabaseState {
  users: User[];
}
