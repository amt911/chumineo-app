import {
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ListingPhotoDto } from '@sobrebox/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { imageUploadOptions } from './multer-image.options';
import { ListingPhotosService } from './listing-photos.service';

@UseGuards(JwtAuthGuard)
@Controller('marketplace/listings/:id/photos')
export class ListingPhotosController {
  constructor(private readonly photos: ListingPhotosService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 5, imageUploadOptions()))
  add(
    @CurrentUser() user: RequestUser,
    @Param('id') listingId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ListingPhotoDto[]> {
    return this.photos.add(user.id, listingId, files);
  }

  @Delete(':photoId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') listingId: string,
    @Param('photoId') photoId: string,
  ): Promise<void> {
    return this.photos.remove(user.id, listingId, photoId);
  }
}
