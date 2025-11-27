import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import axiosInstance from "@/app/actions/axios";
import { authOptions } from "@/app/utils/authOptions";
import { OAUTH_PROVIDERS, OAUTH_URLS } from "@/lib/constants/oauth";

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, state } = await request.json();

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing code or state" },
        { status: 400 },
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(OAUTH_URLS.FORTY_TWO_TOKEN, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.NEXT_PUBLIC_FORTY_TWO_CLIENT_ID!,
        client_secret: process.env.FORTY_TWO_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/callback/${OAUTH_PROVIDERS.FORTY_TWO}`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.json(
        { error: "Failed to exchange authorization code" },
        { status: 400 },
      );
    }

    const tokenData = await tokenResponse.json();

    // Get user profile from 42 API
    const profileResponse = await fetch(OAUTH_URLS.FORTY_TWO_PROFILE, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      console.error("Profile fetch failed:", await profileResponse.text());
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 400 },
      );
    }

    const profile = await profileResponse.json();

    // Link the account via backend API
    try {
      const linkResult = await axiosInstance.post("/social-accounts/link", {
        platform: OAUTH_PROVIDERS.FORTY_TWO,
        username: profile.login,
        platformUserId: profile.id.toString(),
      });

      return NextResponse.json({
        success: true,
        account: linkResult.data,
        profile: {
          login: profile.login,
          displayName: profile.displayname,
          email: profile.email,
        },
      });
    } catch (linkError: any) {
      console.error("Account linking failed:", linkError);
      return NextResponse.json(
        {
          error: linkError.response?.data?.message || "Failed to link account",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("42 linking error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
