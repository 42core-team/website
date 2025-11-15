import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserProps {
  name?: string;
  description?: string;
  avatarProps?: {
    src?: string;
    alt?: string;
    fallback?: string;
    size?: "sm" | "md" | "lg";
    isBordered?: boolean;
    className?: string;
  };
  className?: string;
}

export function User({ name, description, avatarProps, className }: UserProps) {
  const sizeMap = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16",
  };
  const avatarClass = [
    sizeMap[avatarProps?.size || "md"],
    avatarProps?.isBordered ? "border-2 border-primary" : "",
    avatarProps?.className || "",
  ].join(" ");
  return (
    <div className={`flex items-center ${className || ""}`}>
      <Avatar className={avatarClass}>
        <AvatarImage src={avatarProps?.src} alt={avatarProps?.alt} />
        <AvatarFallback>
          {avatarProps?.fallback || (name ? name[0] : "?")}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col ml-4 min-w-0">
        {name && <span className="font-medium truncate">{name}</span>}
        {description && (
          <span className="text-muted-foreground text-sm truncate">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}
