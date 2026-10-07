"use client";

import { usePathname } from "next/navigation";

const hiddenRoutes = ["/login", "/signup", "/dashboard"];

export function useHiddenRoutes() {
  const pathname = usePathname();

  const isHiddenRoute = hiddenRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  return isHiddenRoute;
}
