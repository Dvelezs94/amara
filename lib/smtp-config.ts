export type SmtpEnv = Record<string, string | undefined>;

export type SmtpTransportConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

const GMAIL_SMTP = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
} as const;

export function isGmailSmtpProvider(value: string | undefined): boolean {
  const provider = value?.trim().toLowerCase() ?? "";
  return provider === "gmail" || provider === "google";
}

export function resolveSmtpConfig(
  env: SmtpEnv = process.env
): SmtpTransportConfig | null {
  const gmail = isGmailSmtpProvider(env.SMTP_PROVIDER);
  const host = env.SMTP_HOST?.trim() || (gmail ? GMAIL_SMTP.host : "");
  const user = env.SMTP_USER?.trim() || undefined;
  const passRaw = env.SMTP_PASS?.trim();
  const pass = gmail ? passRaw?.replace(/\s+/g, "") : passRaw;
  const from = env.SMTP_FROM?.trim() || (gmail ? user : undefined) || "";

  if (!host || !from) return null;
  if (gmail && (!user || !pass)) return null;

  const portRaw = env.SMTP_PORT?.trim();
  const parsedPort = portRaw ? Number(portRaw) : NaN;
  const port = Number.isFinite(parsedPort)
    ? parsedPort
    : gmail
      ? GMAIL_SMTP.port
      : 587;

  let secure: boolean;
  if (env.SMTP_SECURE === "1" || env.SMTP_SECURE === "true") secure = true;
  else if (env.SMTP_SECURE === "0" || env.SMTP_SECURE === "false") secure = false;
  else if (gmail) secure = GMAIL_SMTP.secure;
  else secure = port === 465;

  return {
    host,
    port,
    secure,
    user,
    pass: pass || undefined,
    from,
  };
}

export function isSmtpConfigured(env: SmtpEnv = process.env): boolean {
  return resolveSmtpConfig(env) !== null;
}

/** Dev-only banner: do not surface SMTP env var names in production. */
export function shouldShowWorkflowSmtpHint(input: {
  smtpConfigured: boolean;
  nodeEnv?: string;
}): boolean {
  if (input.smtpConfigured) return false;
  return (input.nodeEnv ?? process.env.NODE_ENV) !== "production";
}
