import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RecordingsService } from './recordings.service';

/**
 * Recordings controller — list and playback meeting recordings.
 * JWT + Nurse/Admin/Supervisor roles required (via global guards).
 */
@ApiTags('Recordings')
@ApiBearerAuth()
@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  @Get()
  @ApiOperation({
    summary: 'List meeting recordings',
    description:
      'Returns recordings with metadata. No PHI. Optional filters: locationId, fromDate, toDate.',
  })
  @ApiResponse({ status: 200, description: 'List of recordings' })
  async listRecordings(
    @Query('locationId') locationId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.recordingsService.listRecordings({
      locationId,
      fromDate,
      toDate,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id/playback-url')
  @ApiOperation({
    summary: 'Get pre-signed playback URLs for a recording',
    description:
      'Returns time-limited URLs to stream recording segments. Play in order for full call playback.',
  })
  @ApiResponse({ status: 200, description: 'Playback URLs' })
  @ApiResponse({ status: 404, description: 'Recording not found' })
  async getPlaybackUrls(@Param('id') id: string) {
    return this.recordingsService.getPlaybackUrls(id);
  }
}
