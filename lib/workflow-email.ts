import { resolveSmtpConfig } from "@/lib/smtp-config";

export {
  isGmailSmtpProvider,
  isSmtpConfigured,
  resolveSmtpConfig,
  shouldShowWorkflowSmtpHint,
  type SmtpEnv,
  type SmtpTransportConfig,
} from "@/lib/smtp-config";

export type WorkflowEmailMessage = {
  to: string[];
  subject: string;
  text: string;
};

export async function sendWorkflowEmail(
  message: WorkflowEmailMessage
): Promise<{ ok: true } | { ok: false; skipped?: boolean; error: string }> {
  const to = message.to.filter(Boolean);
  if (to.length === 0) {
    return { ok: false, skipped: true, error: "Sin destinatarios de email" };
  }
  const smtp = resolveSmtpConfig();
  if (!smtp) {
    return { ok: false, skipped: true, error: "SMTP no configurado" };
  }

  try {
    const nodemailer = await import("nodemailer");
    const createTransport =
      nodemailer.createTransport ??
      (nodemailer as { default?: { createTransport?: typeof nodemailer.createTransport } })
        .default?.createTransport;
    if (!createTransport) {
      return { ok: false, error: "nodemailer no disponible" };
    }
    const transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth:
        smtp.user && smtp.pass
          ? {
              user: smtp.user,
              pass: smtp.pass,
            }
          : undefined,
    });
    await transporter.sendMail({
      from: smtp.from,
      to,
      subject: message.subject.slice(0, 200),
      text: message.text,
    });
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al enviar email";
    return { ok: false, error: msg };
  }
}
