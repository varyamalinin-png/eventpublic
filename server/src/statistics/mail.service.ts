import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

export interface MailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  isRead: boolean;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly mailboxes = ["info", "privacy", "support"];

  async getEmails(mailbox?: string): Promise<MailMessage[]> {
    const boxes = mailbox ? [mailbox] : this.mailboxes;
    const emails: MailMessage[] = [];

    for (const box of boxes) {
      const newDir = `/home/${box}/Maildir/new`;
      const curDir = `/home/${box}/Maildir/cur`;

      for (const [dir, isRead] of [[newDir, false], [curDir, true]] as const) {
        try {
          if (!fs.existsSync(dir)) continue;
          const files = fs.readdirSync(dir);
          for (const file of files) {
            try {
              const content = fs.readFileSync(path.join(dir, file), "utf-8");
              const from = content.match(/^From: (.+)$/m)?.[1] || "unknown";
              const subject = content.match(/^Subject: (.+)$/m)?.[1] || "(no subject)";
              const date = content.match(/^Date: (.+)$/m)?.[1] || "";
              const bodyStart = content.indexOf("\n\n");
              const body = bodyStart > -1 ? content.substring(bodyStart + 2).trim() : "";
              
              emails.push({
                id: file,
                from,
                to: `${box}@iwent.ru`,
                subject,
                date,
                body: body.substring(0, 2000),
                isRead: isRead as boolean,
              });
            } catch {}
          }
        } catch {}
      }
    }

    return emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async markAsRead(mailbox: string, emailId: string): Promise<void> {
    const newPath = `/home/${mailbox}/Maildir/new/${emailId}`;
    const curPath = `/home/${mailbox}/Maildir/cur/${emailId}:2,S`;
    try {
      if (fs.existsSync(newPath)) {
        fs.renameSync(newPath, curPath);
      }
    } catch (e) {
      this.logger.error("Failed to mark as read", e);
    }
  }
}
