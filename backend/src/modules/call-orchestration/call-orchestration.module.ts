import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CallOrchestrationService } from './call-orchestration.service';
import { CallOrchestrationController } from './call-orchestration.controller';
import { ChimeModule } from '../chime/chime.module';
import { GetwellStayModule } from '../getwell-stay/getwell-stay.module';
import { WebsocketModule } from '../websocket/websocket.module';

/**
 * Call Orchestration module — the core of the Digital Knock workflow.
 * Coordinates between Chime SDK, GetWell Stay API, and WebSocket signaling.
 */
@Module({
  imports: [ConfigModule, ChimeModule, GetwellStayModule, WebsocketModule],
  controllers: [CallOrchestrationController],
  providers: [CallOrchestrationService],
  exports: [CallOrchestrationService],
})
export class CallOrchestrationModule {}
