import { Controller, Get, Post, Query, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { MailService } from "./mail.service";

@Controller("admin/mail")
@UseGuards(JwtAuthGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get()
  async getEmails(@Query("mailbox") mailbox: string | undefined) {
    return this.mailService.getEmails(mailbox);
  }

  @Post(":mailbox/:emailId/read")
  async markAsRead(@Param("mailbox") mailbox: string, @Param("emailId") emailId: string) {
    await this.mailService.markAsRead(mailbox, emailId);
    return { success: true };
  }
}
