import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { ListQueryDto } from "../../common/dto/list-query.dto";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { DocumentsService } from "./documents.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";

@ApiTags("Documents")
@ApiBearerAuth()
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @ApiOperation({ summary: "List stored documents" })
  @RequirePermissions("files.read")
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() pagination: ListQueryDto) {
    return this.documentsService.list(user, pagination);
  }

  @ApiOperation({ summary: "Create a document metadata record" })
  @RequirePermissions("files.upload")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateDocumentDto) {
    return this.documentsService.create(user, payload);
  }

  @ApiOperation({ summary: "Update document metadata and linkage" })
  @RequirePermissions("files.upload")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() payload: UpdateDocumentDto,
  ) {
    return this.documentsService.update(user, id, payload);
  }

  @ApiOperation({ summary: "Upload a binary document and create its metadata record" })
  @ApiConsumes("multipart/form-data")
  @RequirePermissions("files.upload")
  @UseInterceptors(
    FileInterceptor("file"),
  )
  @Post("upload")
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: any,
    @Body() payload: UploadDocumentDto,
  ) {
    return this.documentsService.upload(user, payload, file);
  }

  @ApiOperation({ summary: "Download a stored document file" })
  @ApiParam({ name: "id", description: "Document file id" })
  @RequirePermissions("files.read")
  @Get(":id/download")
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const file = await this.documentsService.download(user, id);
    response.download(file.absolutePath, file.originalName);
  }
}
