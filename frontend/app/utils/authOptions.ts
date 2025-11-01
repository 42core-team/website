import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const BACKEND_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      id: "backend",
      name: "Backend",
      credentials: {},
      async authorize(_credentials, req) {
        try {
          if (!BACKEND_BASE_URL) {
            console.error("Missing BACKEND URL env");
            return null;
          }

          const cookieHeader = req.headers?.cookie || "";

          // Try to extract the JWT set by the backend from cookies to also send as Bearer
          const match = cookieHeader.match(/(?:^|; )token=([^;]+)/);
          const token = match ? decodeURIComponent(match[1]) : undefined;

          const res = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
            method: "GET",
            headers: {
              // Forward cookies so backend can read its own cookie if configured for shared domain
              cookie: cookieHeader,
              // Also send as Bearer since JwtStrategy extracts from Authorization header
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              Accept: "application/json",
            },
          });

          if (!res.ok) return null;

          const user = await res.json();
          if (!user?.id) return null;

          return {
            id: user.id,
            name: user.name || user.username,
            email: user.email,
            image: user.profilePicture,
          } as any;
        } catch (e) {
          console.error("Authorize failed:", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as any).id || token.sub;
        token.name = user.name || token.name;
        token.email = user.email || token.email;
        (token as any).profilePicture = (user as any).profilePicture;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user) session.user = { id: "", email: "", name: "" } as any;
      (session.user as any).id =
        (token.sub as string) || (session.user as any).id;
      if (token.email) session.user.email = token.email as string;
      if (token.name) session.user.name = token.name as string;
      if ((token as any).profilePicture)
        session.user.profilePicture = (token as any).profilePicture as string;
      return session;
    },
  },
};
