import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import axiosInstance from "@/app/actions/axios";

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.CLIENT_ID_GITHUB!,
      clientSecret: process.env.CLIENT_SECRET_GITHUB!,
      authorization: {
        params: {
          scope: "read:user user:email repo:invite",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github") {
        const githubProfile = profile as any;

        try {
          const existingUser = (
            await axiosInstance.get(`user/github/${account.providerAccountId}`)
          ).data;
          if (!existingUser) {
            if (!account?.access_token) {
              throw new Error("No access token found");
            }

            await axiosInstance.post(`user/`, {
              email: user.email!,
              username: githubProfile?.login || user.name!,
              name: user.name! || githubProfile?.name,
              profilePicture: user.image! || githubProfile?.avatar_url,
              githubId: account.providerAccountId,
              githubAccessToken: account.access_token,
            });
          }
          else {
            await axiosInstance.put(`user/${existingUser.id}`, {
              email: user.email!,
              username: githubProfile?.login || existingUser.username,
              name: githubProfile?.name || existingUser.name,
              profilePicture:
                githubProfile?.avatar_url || existingUser.profilePicture,
              githubId: account.providerAccountId,
              githubAccessToken: account.access_token,
            });
          }
        }
        catch (e: any) {
          console.error("Error during sign in:", e);
          console.error("response:", e?.response);
          return false;
        }
      }

      return true;
    },
    async session({ session }) {
      if (!session.user?.email) {
        throw new Error("User email is not available in session");
      }
      const dbUser = (
        await axiosInstance.get(`user/email/${session.user?.email}`)
      ).data;

      if (dbUser)
        session.user.id = dbUser.id;

      return session;
    },
  },
};
