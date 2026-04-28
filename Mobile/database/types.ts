export interface User {
  fullName?: string;
  city?: string;
  district?: string;
  email: string;
  password?: string;
  isFirstLogin?: boolean;
  profileType?: 'kisisel' | 'kurumsal';
  createdAt?: number;
}

export interface DatabaseState {
  users: User[];
}
