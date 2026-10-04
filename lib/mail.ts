import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Any SMTP provider works. Easiest to start: a Gmail account with an
// "app password" (smtp.gmail.com, port 465). Later: Resend, Postmark, SES...
let transporter: Transporter | null = null;

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);
}

function transport(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/** Plain-text email. In development without SMTP, prints to the console instead. */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
      return;
    }
    throw new Error("Email isn't configured (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM).");
  }
  await transport().sendMail({ from: process.env.MAIL_FROM, to, subject, text });
}

export async function verifyMailConnection(): Promise<void> {
  await transport().verify();
}
