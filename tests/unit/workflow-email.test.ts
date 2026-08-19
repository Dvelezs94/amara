import { describe, expect, it } from "vitest";
import {
  isSmtpConfigured,
  resolveSmtpConfig,
  shouldShowWorkflowSmtpHint,
} from "@/lib/smtp-config";

describe("isSmtpConfigured", () => {
  it("requires host and from address", () => {
    expect(
      isSmtpConfigured({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "msa@example.com" })
    ).toBe(true);
    expect(isSmtpConfigured({ SMTP_HOST: "smtp.example.com" })).toBe(false);
    expect(isSmtpConfigured({})).toBe(false);
  });
});

describe("resolveSmtpConfig", () => {
  it("fills Gmail host/port when SMTP_PROVIDER=gmail", () => {
    expect(
      resolveSmtpConfig({
        SMTP_PROVIDER: "gmail",
        SMTP_USER: "ops@gmail.com",
        SMTP_PASS: "abcd efgh ijkl mnop",
      })
    ).toEqual({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      user: "ops@gmail.com",
      pass: "abcdefghijklmnop",
      from: "ops@gmail.com",
    });
  });

  it("requires Gmail user and app password", () => {
    expect(
      resolveSmtpConfig({
        SMTP_PROVIDER: "google",
        SMTP_USER: "ops@gmail.com",
      })
    ).toBeNull();
  });

  it("lets explicit host/port override the Gmail preset", () => {
    const cfg = resolveSmtpConfig({
      SMTP_PROVIDER: "gmail",
      SMTP_HOST: "smtp.workspace.google.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "1",
      SMTP_USER: "ops@amissa.mx",
      SMTP_PASS: "secret",
      SMTP_FROM: "MSA <ops@amissa.mx>",
    });
    expect(cfg).toMatchObject({
      host: "smtp.workspace.google.com",
      port: 465,
      secure: true,
      from: "MSA <ops@amissa.mx>",
    });
  });
});

describe("shouldShowWorkflowSmtpHint", () => {
  it("hides the SMTP setup banner in production", () => {
    expect(
      shouldShowWorkflowSmtpHint({
        smtpConfigured: false,
        nodeEnv: "production",
      })
    ).toBe(false);
    expect(
      shouldShowWorkflowSmtpHint({
        smtpConfigured: false,
        nodeEnv: "development",
      })
    ).toBe(true);
    expect(
      shouldShowWorkflowSmtpHint({
        smtpConfigured: true,
        nodeEnv: "development",
      })
    ).toBe(false);
  });
});
