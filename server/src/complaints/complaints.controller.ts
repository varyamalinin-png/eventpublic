import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ComplaintStatus } from '@prisma/client';

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  async createComplaint(@Request() req, @Body() dto: CreateComplaintDto) {
    try {
      return await this.complaintsService.createComplaint(req.user.id, dto);
    } catch (error) {
      console.error('[ComplaintsController] Error creating complaint:', error);
      throw error;
    }
  }

  @Get()
  async getComplaints(@Request() req, @Query('status') status?: ComplaintStatus) {
    return this.complaintsService.getComplaints(req.user.id, status);
  }

  @Get('count/:userId')
  @UseGuards(JwtAuthGuard)
  async getComplaintsCount(@Param('userId') userId: string) {
    return { count: await this.complaintsService.getComplaintsCountForUser(userId) };
  }

  // Админские endpoints
  @UseGuards(AdminGuard)
  @Get('admin/all')
  async getAllComplaints(@Request() req, @Query('status') status?: ComplaintStatus) {
    return this.complaintsService.getAllComplaints(status);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/:id/status')
  async updateComplaintStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { status: ComplaintStatus; adminResponse?: string },
  ) {
    return this.complaintsService.updateComplaintStatus(
      id,
      body.status,
      body.adminResponse,
      req.user.id,
    );
  }
}

