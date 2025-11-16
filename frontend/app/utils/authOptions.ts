import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import axiosInstance from "@/app/actions/axios";

const BACKEND_BASE_URL
  = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      id: "backend",
      name: "Backend",
      credentials: {},
      async authorize(_credentials, _) {
        try {
          if (!BACKEND_BASE_URL) {
            console.error("Missing BACKEND URL env");
            return null;
          }

          const res = await axiosInstance.get<{
            id: string;
            username: string;
            email: string;
            profilePicture: string;
          }>(`/auth/me`);

          return {
            id: res.data.id,
            name: res.data.username,
            email: res.data.email,
            image: res.data.profilePicture,
          };
        }
        catch (e) {
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
      }
      return token;
    },
    async session({ session, _ }) {
      try {
        const res = await axiosInstance.get<{
          id: string;
          username: string;
          email: string;
          profilePicture: string;
        }>(`/auth/me`);

        session.user.id = res.data.id;
        session.user.email = res.data.email;
        session.user.name = res.data.username;
        session.user.profilePicture = res.data.profilePicture;
      }
      catch {
        session.user.id = "";
      }

      return session;
    },
  },
};
