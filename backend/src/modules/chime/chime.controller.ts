import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import axios from 'axios';
import { CHIME_NEAREST_REGION_URL, CHIME_DEFAULT_REGION } from '../../common/constants/app.constants';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Chime Controller — public utility endpoints for Chime SDK.
 */
@ApiTags('Amazon Chime SDK')
@Controller('chime')
export class ChimeController {
  /**
   * Get the nearest Chime media region for this client.
   * Per Amazon Chime SDK Developer Guide: frontend should call this before
   * initiating a call, then send the returned region to POST /api/calls.
   *
   * This endpoint proxies the request to avoid CORS issues.
   */
  @Public()
  @Get('nearest-region')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get nearest Chime media region',
    description:
      'Pings Amazon\'s nearest-media-region endpoint to determine the optimal region for low latency.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nearest region determined',
    schema: {
      type: 'object',
      properties: {
        region: { type: 'string', example: 'us-east-1' },
      },
    },
  })
  async getNearestRegion(): Promise<{ region: string }> {
    try {
      const response = await axios.get<{ region: string }>(
        CHIME_NEAREST_REGION_URL,
        { timeout: 3000 },
      );
      return { region: response.data.region || CHIME_DEFAULT_REGION };
    } catch {
      // Fallback to configured region if endpoint unreachable
      return { region: CHIME_DEFAULT_REGION };
    }
  }
}
