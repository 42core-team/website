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
    <div className="relative flex min-h-lvh flex-col">
      <Head />
      <BasicNavbar session={session} />
      <main className="container mx-auto max-w-7xl grow px-6">{children}</main>
      <Footer />
    </div>
  );
}
