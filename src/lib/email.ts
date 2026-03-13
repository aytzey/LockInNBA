import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { getOptionalEnv } from "./env";

interface MagicLinkEmailInput {
  to: string;
  magicLinkUrl: string;
}

let sesClient: SESv2Client | null = null;

function getSesClient(): SESv2Client {
  if (!sesClient) {
    sesClient = new SESv2Client({
      region: getOptionalEnv("AWS_REGION") || process.env.AWS_DEFAULT_REGION || "us-east-1",
    });
  }

  return sesClient;
}

export function getMailFromAddress(): string | null {
  return getOptionalEnv("LOCKIN_MAIL_FROM");
}

export async function sendMagicLinkEmail(input: MagicLinkEmailInput): Promise<void> {
  const fromAddress = getMailFromAddress();
  if (!fromAddress) {
    throw new Error("Missing required environment variable: LOCKIN_MAIL_FROM");
  }

  const textBody = [
    "Restore your LOCKIN access",
    "",
    "Use the link below to restore today's paid access:",
    input.magicLinkUrl,
    "",
    "This link expires in 1 hour and can only be used once.",
    "",
    "If you did not request this email, you can ignore it.",
  ].join("\n");

  const htmlBody = [
    "<div style=\"background:#0a0e1a;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#f5f5f3;\">",
    "<div style=\"max-width:560px;margin:0 auto;border:1px solid rgba(139,146,165,0.22);border-radius:20px;padding:32px 28px;background:linear-gradient(180deg,rgba(16,21,34,0.98),rgba(10,14,26,0.98));\">",
    "<div style=\"font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;\">LOCKIN</div>",
    "<p style=\"margin:24px 0 10px;font-size:20px;line-height:1.3;font-weight:700;\">Restore your access</p>",
    "<p style=\"margin:0 0 24px;font-size:14px;line-height:1.6;color:#8b92a5;\">Use the secure link below to restore today's paid card. The link expires in 1 hour and works once.</p>",
    `<a href="${input.magicLinkUrl}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#00c853;color:#04110a;font-size:14px;font-weight:700;text-decoration:none;">Restore today's access</a>`,
    `<p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:#8b92a5;word-break:break-all;">If the button does not open, use this link:<br><a href="${input.magicLinkUrl}" style="color:#ffd700;text-decoration:none;">${input.magicLinkUrl}</a></p>`,
    "<p style=\"margin:24px 0 0;font-size:11px;line-height:1.6;color:#8b92a5;\">If you did not request this email, you can ignore it.</p>",
    "</div>",
    "</div>",
  ].join("");

  await getSesClient().send(
    new SendEmailCommand({
      FromEmailAddress: fromAddress,
      Destination: {
        ToAddresses: [input.to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: "Restore your LOCKIN access",
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: textBody,
              Charset: "UTF-8",
            },
            Html: {
              Data: htmlBody,
              Charset: "UTF-8",
            },
          },
        },
      },
    }),
  );
}
