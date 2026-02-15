import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../config/redis.config';
import {
  REDIS_KEYS,
  DEVICE_HEARTBEAT_INTERVAL_MS,
  DEVICE_OFFLINE_THRESHOLD,
  AUDIT_EVENTS,
} from '../../common/constants/app.constants';
import { DeviceStatus } from '../../common/enums';
// Import as values (not type-only) for decorator metadata compatibility
import {
  DeviceJoinMeetingEvent,
  DeviceLeaveMeetingEvent,
} from './interfaces/websocket.interfaces';

/**
 * WebSocket Gateway for Camera Device and Patient signaling.
 *
 * Handles:
 * - Device registration and persistent connection (kiosk mode)
 * - Patient registration for receiving incoming calls
 * - Heartbeat/Watchdog health monitoring
 * - "Wake Up" signal to join Chime meeting when patient accepts
 * - PTZ commands relayed from Nurse Console to Camera
 * - Call termination signals
 */
@WebSocketGateway({
  namespace: '/devices',
  cors: { origin: '*' },
})
export class DeviceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DeviceGateway.name);

  /** Maps deviceId → socket.id for targeted messaging */
  private deviceSockets = new Map<string, string>();

  /** Maps locationId → deviceId for location-based lookup */
  private locationDevices = new Map<string, string>();

  /** Maps locationId → socket.id for patient browser connections */
  private patientSockets = new Map<string, string>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Handle new WebSocket connection from a camera device.
   */
  handleConnection(client: Socket): void {
    this.logger.log({
      message: 'Device connected',
      socketId: client.id,
    });
  }

  /**
   * Handle device/patient disconnection.
   * Mark device as OFFLINE in Redis and clean up maps.
   */
  async handleDisconnect(client: Socket): Promise<void> {
    // Find the device that disconnected
    let disconnectedDevice: string | null = null;
    for (const [deviceId, socketId] of this.deviceSockets.entries()) {
      if (socketId === client.id) {
        disconnectedDevice = deviceId;
        break;
      }
    }

    if (disconnectedDevice) {
      this.deviceSockets.delete(disconnectedDevice);

      // Update Redis state
      await this.redis.set(
        `${REDIS_KEYS.DEVICE_STATE}${disconnectedDevice}`,
        DeviceStatus.OFFLINE,
      );

      this.logger.log({
        message: 'Device disconnected — marked OFFLINE',
        deviceId: disconnectedDevice,
        event: AUDIT_EVENTS.DEVICE_OFFLINE,
      });
    }

    // Clean up patient socket mapping
    for (const [locId, socketId] of this.patientSockets.entries()) {
      if (socketId === client.id) {
        this.patientSockets.delete(locId);
        this.logger.log({
          message: 'Patient disconnected',
          locationId: locId,
        });
        break;
      }
    }
  }

  /**
   * Device registration — called immediately after connection.
   * Associates deviceId + locationId with this socket.
   */
  @SubscribeMessage('register')
  async handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { type: string; deviceId: string; locationId: string; firmwareVersion?: string; capabilities?: string[] },
  ): Promise<{ status: string }> {
    const { deviceId, locationId } = data;

    this.deviceSockets.set(deviceId, client.id);
    this.locationDevices.set(locationId, deviceId);

    // Join a room named by locationId for targeted broadcasts
    client.join(`location:${locationId}`);
    client.join(`device:${deviceId}`);

    // Mark device as ONLINE in Redis
    await this.redis.set(
      `${REDIS_KEYS.DEVICE_STATE}${deviceId}`,
      DeviceStatus.ONLINE,
    );

    this.logger.log({
      message: 'Device registered',
      deviceId,
      locationId,
      event: AUDIT_EVENTS.DEVICE_ONLINE,
    });

    return { status: 'registered' };
  }

  /**
   * Patient registration — called from the patient browser.
   * Associates a patient socket with a locationId so they can receive incoming calls.
   */
  @SubscribeMessage('register_patient')
  async handleRegisterPatient(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { locationId: string },
  ): Promise<{ status: string; locationId: string }> {
    const { locationId } = data;

    this.patientSockets.set(locationId, client.id);

    // Join room so patient receives location-specific events
    client.join(`patient:${locationId}`);
    client.join(`location:${locationId}`);

    // Also register as a "device" so isDeviceOnline() passes for demo
    const pseudoDeviceId = `patient-device-${locationId}`;
    this.deviceSockets.set(pseudoDeviceId, client.id);
    this.locationDevices.set(locationId, pseudoDeviceId);

    await this.redis.set(
      `${REDIS_KEYS.DEVICE_STATE}${pseudoDeviceId}`,
      DeviceStatus.ONLINE,
    );

    this.logger.log({
      message: 'Patient registered for room',
      locationId,
      socketId: client.id,
    });

    return { status: 'registered', locationId };
  }

  /**
   * Nurse Console (or any client) joins a location room to receive call_status_update.
   * Call after initiating a call so the console gets RINGING → CONNECTED → TERMINATED.
   */
  @SubscribeMessage('join_location')
  handleJoinLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { locationId: string },
  ): void {
    const { locationId } = data;
    if (locationId) {
      client.join(`location:${locationId}`);
      this.logger.debug({ message: 'Client joined location room', locationId, socketId: client.id });
    }
  }

  /**
   * Process heartbeat from camera device.
   * Updates last-seen timestamp in Redis for watchdog monitoring.
   */
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @MessageBody() data: { type: string; deviceId: string; locationId: string; timestamp: string; status: string },
  ): Promise<void> {
    const { deviceId } = data;

    // Update heartbeat timestamp in Redis (TTL = interval * threshold)
    const ttl = Math.ceil(
      (DEVICE_HEARTBEAT_INTERVAL_MS * DEVICE_OFFLINE_THRESHOLD) / 1000,
    );
    await this.redis.setex(
      `${REDIS_KEYS.DEVICE_HEARTBEAT}${deviceId}`,
      ttl,
      Date.now().toString(),
    );
  }

  /**
   * Check if a device at a given location is online and healthy.
   * Used by Call Orchestration before initiating a call.
   */
  async isDeviceOnline(locationId: string): Promise<boolean> {
    const deviceId = this.locationDevices.get(locationId);
    if (!deviceId) return false;

    const state = await this.redis.get(
      `${REDIS_KEYS.DEVICE_STATE}${deviceId}`,
    );
    return state === DeviceStatus.ONLINE || state === DeviceStatus.IN_CALL;
  }

  /**
   * Signal the camera device to join a Chime meeting.
   * Called when patient ACCEPTS the call (or on emergency override).
   */
  async signalDeviceJoinMeeting(
    locationId: string,
    event: DeviceJoinMeetingEvent,
  ): Promise<boolean> {
    const deviceId = this.locationDevices.get(locationId);
    if (!deviceId) {
      this.logger.warn({
        message: 'No device registered for location',
        locationId,
      });
      return false;
    }

    const socketId = this.deviceSockets.get(deviceId);
    if (!socketId) {
      this.logger.warn({
        message: 'Device registered but not connected',
        deviceId,
        locationId,
      });
      return false;
    }

    // Update device state to IN_CALL
    await this.redis.set(
      `${REDIS_KEYS.DEVICE_STATE}${deviceId}`,
      DeviceStatus.IN_CALL,
    );

    // Send join signal to the specific device
    this.server.to(`device:${deviceId}`).emit('join_meeting', event);

    this.logger.log({
      message: 'JOIN_MEETING signal sent to device',
      deviceId,
      locationId,
      meetingId: event.meetingId,
    });

    return true;
  }

  /**
   * Signal the camera device to leave the meeting.
   * Called when the call ends.
   */
  async signalDeviceLeaveMeeting(
    locationId: string,
    event: DeviceLeaveMeetingEvent,
  ): Promise<void> {
    const deviceId = this.locationDevices.get(locationId);
    if (!deviceId) return;

    // Reset device state to ONLINE
    await this.redis.set(
      `${REDIS_KEYS.DEVICE_STATE}${deviceId}`,
      DeviceStatus.ONLINE,
    );

    this.server.to(`device:${deviceId}`).emit('leave_meeting', event);

    this.logger.log({
      message: 'LEAVE_MEETING signal sent to device',
      deviceId,
      locationId,
    });
  }

  /**
   * Relay PTZ command from Nurse Console to Camera Device.
   */
  @SubscribeMessage('ptz_command')
  async handlePtzCommand(@MessageBody() data: { type: string; deviceId: string; command: string; value?: number }): Promise<void> {
    const { deviceId, command, value } = data;
    const socketId = this.deviceSockets.get(deviceId);

    if (!socketId) {
      this.logger.warn({
        message: 'PTZ command target device not connected',
        deviceId,
      });
      return;
    }

    this.server.to(`device:${deviceId}`).emit('ptz_command', { command, value });
  }

  /**
   * Send a call status update to the Nurse Console room.
   */
  emitCallStatusUpdate(
    locationId: string,
    meetingId: string,
    status: string,
  ): void {
    this.server.to(`location:${locationId}`).emit('call_status_update', {
      type: 'CALL_STATUS_UPDATE',
      meetingId,
      locationId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify the patient browser of an incoming call.
   * Sends to the patient:${locationId} room.
   */
  notifyPatientIncomingCall(
    locationId: string,
    data: {
      meetingId: string;
      callerName: string;
      callType: string;
      sessionId: string;
    },
  ): void {
    this.server.to(`patient:${locationId}`).emit('incoming_call', {
      type: 'INCOMING_CALL',
      meetingId: data.meetingId,
      callerName: data.callerName,
      callType: data.callType,
      sessionId: data.sessionId,
      locationId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log({
      message: 'Incoming call notification sent to patient',
      locationId,
      meetingId: data.meetingId,
    });
  }

  /**
   * Notify the patient browser that a call has ended.
   */
  notifyPatientCallEnded(locationId: string, meetingId: string): void {
    this.server.to(`patient:${locationId}`).emit('call_ended', {
      type: 'CALL_ENDED',
      meetingId,
      locationId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check if a patient is connected at a location.
   */
  isPatientOnline(locationId: string): boolean {
    return this.patientSockets.has(locationId);
  }
}
