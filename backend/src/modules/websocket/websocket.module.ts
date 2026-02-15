import { Module } from '@nestjs/common';
import { DeviceGateway } from './device.gateway';

/**
 * WebSocket module for real-time signaling.
 * Manages device connections, heartbeats, meeting signals, and PTZ relay.
 */
@Module({
  providers: [DeviceGateway],
  exports: [DeviceGateway],
})
export class WebsocketModule {}
