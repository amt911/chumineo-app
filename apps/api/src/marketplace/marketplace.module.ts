import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ListingPhotosController } from './listing-photos.controller';
import { ListingPhotosService } from './listing-photos.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  controllers: [ListingsController, ListingPhotosController, MatchesController],
  providers: [ListingsService, ListingPhotosService, MatchesService],
  exports: [ListingsService],
})
export class MarketplaceModule {}
