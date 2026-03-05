export interface JwtPayload {
  userId: string;
  phone: string;
  activeRole: string;
  iat?: number;
  exp?: number;
}
