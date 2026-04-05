import type { NextAuthOptions } from "next-auth";
import type { AuthUserProfile } from "@/lib/backend/types/user";
import CredentialsProvider from "next-auth/providers/credentials";
import { serverHttp } from "@/lib/backend/http/server";

const BACKEND_BASE_URL
  = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL;

async function getCurrentUserProfile(): Promise<AuthUserProfile> {
  return (
    await serverHttp.get<AuthUserProfile>("/auth/me")
  ).data;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [
    CredentialsProvider({
      id: "backend",
      name: "Backend",
      credentials: {},
      async authorize() {
        try {
          if (!BACKEND_BASE_URL) {
            console.error("Missing BACKEND URL env");
            return null;
          }

          const profile = await getCurrentUserProfile();

          return {
            id: profile.id,
            name: profile.username,
            email: profile.email,
            profilePicture: profile.profilePicture,
          };
        }
        catch (error) {
          console.error("Authorize failed in authOptions authorize:", error);
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
      }
      return token;
    },
    async session({ session }) {
      try {
        const profile = await getCurrentUserProfile();

        session.user.id = profile.id;
        session.user.email = profile.email;
        session.user.name = profile.username;
        session.user.profilePicture = profile.profilePicture;
      }
      catch {
        session.user.id = "";
      }

      return session;
    },
  },
};
