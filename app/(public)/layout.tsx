import { PublicFooter, PublicHeader } from "@/components/public-shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="public-site"><PublicHeader/><main>{children}</main><PublicFooter/></div>;
}
