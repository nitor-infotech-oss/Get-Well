import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { SYSTEM_NAME } from '../../common/constants/app.constants';
import {
  StartCallPayload,
  EndCallPayload,
  OAuthTokenResponse,
} from './interfaces/getwell-stay.interfaces';

/**
 * GetWell Stay API Integration Service.
 *
 * Implements the REST client for the GetWell Video Integration API:
 * - OAuth2 Client Credentials authentication
 * - POST /api/video/integration/v1/start_call (trigger "Digital Knock")
 * - POST /api/video/integration/v1/end_call (restore TV state)
 *
 * Source: GW-Video-Integration-REST-API.pdf
 */
@Injectable()
export class GetwellStayService implements OnModuleInit {
  private readonly logger = new Logger(GetwellStayService.name);
  private httpClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const baseUrl = this.configService.get<string>('getwellStay.baseUrl');

    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 5000, // 5s timeout for external API calls
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`GetWell Stay API client initialized: ${baseUrl}`);
  }

  /**
   * Obtain OAuth2 access token using Client Credentials grant.
   * Token is cached until expiry to avoid unnecessary auth calls.
   *
   * Auth: POST /oauth/token with Basic header (Base64 client_id:client_secret)
   */
  private async authenticate(): Promise<string> {
    // Return cached token if still valid (with 30s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) {
      return this.accessToken;
    }

    const clientId = this.configService.get<string>('getwellStay.clientId');
    const clientSecret = this.configService.get<string>('getwellStay.clientSecret');
    const tokenEndpoint = this.configService.get<string>('getwellStay.tokenEndpoint');

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    this.logger.log({ message: 'Requesting OAuth2 token from GetWell Stay' });

    const response = await this.httpClient.post<OAuthTokenResponse>(
      tokenEndpoint!,
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

    this.logger.log({ message: 'OAuth2 token acquired successfully' });
    return this.accessToken!;
  }

  /**
   * Trigger the "Digital Knock" on the patient TV.
   * The TV will interrupt current programming and show the incoming call prompt.
   *
   * POST /api/video/integration/v1/start_call
   */
  async startCall(
    locationId: string,
    meetingId: string,
    callerName: string,
    callType: 'regular' | 'override' = 'regular',
  ): Promise<void> {
    const token = await this.authenticate();

    const payload: StartCallPayload = {
      locationId,
      meetingId,
      callerName,
      systemName: SYSTEM_NAME,
      callType,
    };

    this.logger.log({
      message: 'Sending start_call to GetWell Stay',
      locationId,
      meetingId,
      callType,
      // callerName intentionally NOT logged — could be considered identifying info
    });

    await this.httpClient.post(
      '/api/video/integration/v1/start_call',
      payload,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    this.logger.log({
      message: 'start_call sent successfully',
      locationId,
      meetingId,
    });
  }

  /**
   * Signal the TV to end the call and restore its previous state (HDMI-CEC switch back).
   *
   * POST /api/video/integration/v1/end_call
   */
  async endCall(locationId: string, meetingId: string): Promise<void> {
    const token = await this.authenticate();

    const payload: EndCallPayload = {
      locationId,
      meetingId,
      systemName: SYSTEM_NAME,
    };

    this.logger.log({
      message: 'Sending end_call to GetWell Stay',
      locationId,
      meetingId,
    });

    await this.httpClient.post(
      '/api/video/integration/v1/end_call',
      payload,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    this.logger.log({
      message: 'end_call sent successfully',
      locationId,
      meetingId,
    });
  }
}
