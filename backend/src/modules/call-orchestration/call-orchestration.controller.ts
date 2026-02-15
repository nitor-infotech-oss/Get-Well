import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CallOrchestrationService } from './call-orchestration.service';
import { InitiateCallDto } from './dto/initiate-call.dto';
import { PatientActionDto } from '../getwell-stay/dto/patient-action.dto';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Call Orchestration Controller.
 *
 * Exposes the REST endpoints for the Digital Knock workflow:
 * - POST /calls          → Nurse initiates a call
 * - POST /calls/webhook  → Patient action webhook from TV
 * - POST /calls/:id/end  → End an active call
 */
@ApiTags('Call Orchestration')
@ApiBearerAuth()
@Controller('calls')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CallOrchestrationController {
  constructor(
    private readonly callOrchestrationService: CallOrchestrationService,
  ) {}

  /**
   * Nurse initiates a call to a patient room.
   * This triggers the entire Digital Knock workflow.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initiate a video call to a patient room',
    description:
      'Creates a Chime meeting, signals the TV (Digital Knock), and returns join info for the Nurse Console.',
  })
  @ApiResponse({ status: 201, description: 'Call initiated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or active call exists' })
  @ApiResponse({ status: 503, description: 'Camera device offline' })
  async initiateCall(@Body() dto: InitiateCallDto) {
    return this.callOrchestrationService.initiateCall(dto);
  }

  /**
   * Webhook endpoint for patient action from the TV system.
   * Called by GetWell Stay when the patient responds to the incoming call.
   *
   * POST /api/ipc/client/action (mapped to /calls/webhook here)
   */
  @Public() // Webhook from TV system — no JWT
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive patient action webhook from TV',
    description: 'Handles ACCEPTED, DECLINED, or IGNORED actions from the patient TV.',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handlePatientAction(@Body() dto: PatientActionDto) {
    await this.callOrchestrationService.handlePatientAction(dto);
    return { status: 'ok' };
  }

  /**
   * Patient accepts an incoming call from their browser.
   * Creates a Chime attendee for the patient and returns meeting credentials.
   *
   * POST /api/calls/patient-accept { meetingId, locationId }
   */
  @Public() // No JWT for patient browser
  @Post('patient-accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Patient accepts incoming call from browser',
    description:
      'Creates a patient attendee for the Chime meeting and returns credentials to join.',
  })
  @ApiResponse({ status: 200, description: 'Patient joined — Chime credentials returned' })
  @ApiResponse({ status: 400, description: 'No active call or invalid state' })
  async patientAcceptCall(
    @Body() body: { meetingId: string; locationId: string },
  ) {
    return this.callOrchestrationService.patientAcceptCall(
      body.meetingId,
      body.locationId,
    );
  }

  /**
   * Patient declines an incoming call from their browser.
   *
   * POST /api/calls/patient-decline { meetingId }
   */
  @Public()
  @Post('patient-decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Patient declines incoming call from browser',
    description: 'Tears down the Chime meeting and notifies the nurse.',
  })
  @ApiResponse({ status: 200, description: 'Call declined' })
  async patientDeclineCall(@Body() body: { meetingId: string }) {
    await this.callOrchestrationService.patientDeclineCall(body.meetingId);
    return { status: 'declined' };
  }

  /**
   * End an active call session.
   * Tears down the Chime meeting, stops recording, restores TV.
   */
  @Post(':sessionId/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'End an active call',
    description: 'Terminates the call, stops recording, deletes the Chime meeting, and restores the TV.',
  })
  @ApiResponse({ status: 200, description: 'Call ended' })
  @ApiResponse({ status: 400, description: 'Session not found' })
  async endCall(@Param('sessionId') sessionId: string) {
    await this.callOrchestrationService.endCall(sessionId);
    return { status: 'terminated' };
  }
}
