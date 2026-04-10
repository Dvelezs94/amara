import { userInitials, resolveAvatarBackgroundColor } from "@/lib/avatar-helpers";

const sizes = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
} as const;

export function UserAvatar({
  userId,
  name,
  avatarUrl,
  avatarBackgroundColor,
  size = "md",
  className = "",
}: {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  /** Color de fondo con iniciales (#RRGGBB), desde BD; si falta se deriva del id */
  avatarBackgroundColor?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const sz = sizes[size];
  const round = "rounded-full shrink-0";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={`${sz} ${round} object-cover ${className}`}
      />
    );
  }

  const bg = resolveAvatarBackgroundColor(userId, avatarBackgroundColor);
  return (
    <div
      className={`${sz} ${round} flex items-center justify-center font-bold text-white ${className}`}
      style={{ backgroundColor: bg }}
      aria-hidden
    >
      {userInitials(name)}
    </div>
  );
}
