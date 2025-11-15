"use client";

import type { SocialAccount } from "@/app/actions/social-accounts";
import { useSession } from "next-auth/react";
import { usePlausible } from "next-plausible";
import { useCallback, useEffect, useState } from "react";
import {
  getSocialAccounts,

  unlinkSocialAccount,
} from "@/app/actions/social-accounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { use42Linking } from "@/hooks/use42Linking";
import { OAUTH_PROVIDERS } from "@/lib/constants/oauth";
import {
  getPlatformIcon,
  getPlatformName,
} from "@/lib/constants/platform-icons";

export default function SocialAccountsDisplay() {
  const plausible = usePlausible();

  const { data: session } = useSession();
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [_unlinkingAccount, setUnlinkingAccount] = useState<string | null>(null);

  const loadSocialAccounts = useCallback(async () => {
    if (!session?.user?.id)
      return;

    try {
      const accounts = await getSocialAccounts();
      setSocialAccounts(accounts);
    }
    catch (error) {
      console.error("Error loading social accounts:", error);
    }
    finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const { message, isInitiating, initiate42OAuth, clearMessage } = use42Linking(
    loadSocialAccounts, // Use the stable callback
  );

  useEffect(() => {
    if (session?.user?.id) {
      loadSocialAccounts();
    }
  }, [session, loadSocialAccounts]);

  // Clear any lingering error messages when we detect a new 42 account
  useEffect(() => {
    const has42Account = socialAccounts.some(
      account => account.platform === OAUTH_PROVIDERS.FORTY_TWO,
    );
    if (has42Account && message?.type === "error") {
      // Clear error message after account is successfully linked
      clearMessage();
    }
  }, [socialAccounts, message, clearMessage]);

  const handleUnlink = async (platform: string) => {
    plausible("unlink_account", {
      props: {
        platform,
      },
    });
    if (
      !session?.user?.id
      || !confirm("Are you sure you want to unlink this account?")
    ) {
      return;
    }

    setUnlinkingAccount(platform);
    try {
      await unlinkSocialAccount(platform);
      setSocialAccounts(accounts =>
        accounts.filter(account => account.platform !== platform),
      );
    }
    catch (error) {
      console.error("Error unlinking account:", error);
      alert("Failed to unlink account. Please try again.");
    }
    finally {
      setUnlinkingAccount(null);
    }
  };

  const get42Account = () =>
    socialAccounts.find(
      account => account.platform === OAUTH_PROVIDERS.FORTY_TWO,
    );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[100px]">
        <div className="text-muted-foreground">Loading social accounts...</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked Accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {socialAccounts.length === 0
          ? (
              <p className="text-muted-foreground">
                No social accounts linked yet.
              </p>
            )
          : (
              <div className="space-y-3">
                {socialAccounts.map(account => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 border border-default-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 text-2xl">
                        {getPlatformIcon(account.platform)}
                      </div>
                      <div>
                        <p className="font-medium">
                          {getPlatformName(account.platform)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          @
                          {account.username}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      color="danger"
                      onClick={() => handleUnlink(account.platform)}
                      // TODO: isLoading={unlinkingAccount === account.platform}
                    >
                      Unlink
                    </Button>
                  </div>
                ))}
              </div>
            )}

        {!get42Account() && (
          <div className="border-t border-default-200 pt-4">
            <div className="flex items-center justify-between p-3 border border-default-200 rounded-lg border-dashed">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 text-2xl">
                  {getPlatformIcon(OAUTH_PROVIDERS.FORTY_TWO)}
                </div>
                <div>
                  <p className="font-medium">42 School</p>
                  <p className="text-sm text-muted-foreground">Not connected</p>
                </div>
              </div>
              <Button
                size="sm"
                color="primary"
                onClick={() => {
                  plausible("link_account", {
                    props: {
                      platform: OAUTH_PROVIDERS.FORTY_TWO,
                    },
                  });
                  initiate42OAuth();
                }}
                // TODO: isLoading={isInitiating}
                // spinner={
                //   <svg
                //     className="animate-spin h-4 w-4"
                //     fill="none"
                //     viewBox="0 0 24 24"
                //   >
                //     <circle
                //       className="opacity-25"
                //       cx="12"
                //       cy="12"
                //       r="10"
                //       stroke="currentColor"
                //       strokeWidth="4"
                //     ></circle>
                //     <path
                //       className="opacity-75"
                //       fill="currentColor"
                //       d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                //     ></path>
                //   </svg>
                // }
              >
                {isInitiating ? "Connecting..." : "Connect"}
              </Button>
            </div>
          </div>
        )}

        {message && message.type === "error" && (
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg dark:bg-danger-100/10">
            <div className="flex items-start gap-3">
              <span className="text-danger text-lg shrink-0 mt-0.5">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-danger">
                  Connection Failed
                </p>
                <p className="text-xs text-danger-600 mt-1 wrap-break-word">
                  {message.text}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    color="danger"
                    onClick={initiate42OAuth}
                    className="h-8"
                  >
                    Try Again
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    onClick={clearMessage}
                    className="h-8"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
