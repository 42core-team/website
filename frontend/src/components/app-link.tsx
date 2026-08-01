import { Link as RouterLink } from "@tanstack/react-router";
import React from "react";

type AppLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  href?: string;
  to?: string;
};

export default function Link({ href, to, ...props }: AppLinkProps) {
  const target = to || href || "/";

  if (/^(https?:|mailto:|tel:)/.test(target) || props.target === "_blank") {
    return <a href={target} {...props} />;
  }

  return <RouterLink to={target} {...props} />;
}
