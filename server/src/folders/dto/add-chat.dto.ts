import { IsUUID } from 'class-validator';

export class AddChatToFolderDto {
  @IsUUID()
  chatId!: string;
}

