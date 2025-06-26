"use client";
import Image from "next/image";
import { useTheme } from "next-themes";

export default function LogoSwitcher({ size = 48 }: { size?: number }) {
  const { theme } = useTheme();
  const logo = theme === "dark" ? "/logo-dark.png" : "/logo-light.png";
  return (
    <Image src={logo} alt="pseudofi logo" width={size} height={size} priority />
  );
} 