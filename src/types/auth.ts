export interface User {
  name: string;
  email?: string;
  guest: boolean;
}

export interface Account {
  name: string;
  email: string;
  hash: string;
}
