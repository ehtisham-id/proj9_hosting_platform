export interface User {
  id: number;
  email: string;
  role: 'user' | 'admin';
  password_hash: string;
}

export type AppRole = 'owner' | 'viewer';
export type UserRole = 'user' | 'admin';
