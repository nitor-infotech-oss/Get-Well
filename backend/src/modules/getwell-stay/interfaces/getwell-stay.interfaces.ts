/**
 * Interfaces for the GetWell Stay API integration.
 * Source: GW-Video-Integration-REST-API.pdf
 */

export interface StartCallPayload {
  locationId: string;
  meetingId: string;
  callerName: string;
  systemName: string;
  callType: 'regular' | 'override';
}

export interface EndCallPayload {
  locationId: string;
  meetingId: string;
  systemName: string;
}

export interface PatientActionWebhook {
  action: 'ACCEPTED' | 'DECLINED' | 'IGNORED';
  time: string;
  locationId: string;
  meetingId: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}
