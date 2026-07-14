"use client";

import { useAuth } from "./auth-provider";

export function UserFirstName() {
  const { user } = useAuth();
  return <>{user?.name.split(" ")[0] ?? "Reader"}</>;
}
