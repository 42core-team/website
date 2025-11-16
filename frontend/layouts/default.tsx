import { getServerSession } from "next-auth/next";

import { authOptions } from "@/app/utils/authOptions";
import BasicNavbar from "./basic-navbar";
import Footer from "./footer";
import { Head } from "./head";

export default async function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <div className="relative flex flex-col min-h-lvh overflow-x-hidden">
      <Head />
      <BasicNavbar session={session} />
      <main className="container mx-auto max-w-7xl px-6 grow">{children}</main>
      <Footer />
    </div>
  );
}
