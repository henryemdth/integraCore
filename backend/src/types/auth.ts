/** Claims carried by the JWT, and the shape attached to `req.user` after authentication. */
export interface JwtPayload {
  id: number;
  username: string;
  role: "admin" | "user";
}
