import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GetwellStayService } from './getwell-stay.service';

/**
 * GetWell Stay API Integration module.
 * Handles OAuth2 auth, start_call (Digital Knock), and end_call (TV restore).
 */
@Module({
  imports: [ConfigModule],
  providers: [GetwellStayService],
  exports: [GetwellStayService],
})
export class GetwellStayModule {}
