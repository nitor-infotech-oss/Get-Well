import { randomUUID } from 'crypto';

/**
 * Generate a unique ClientRequestToken for Chime SDK API calls.
 *
 * Per Amazon Chime SDK Developer Guide:
 * "You MUST generate and send a unique ClientRequestToken when creating
 * meetings or media pipelines to prevent duplicate billing/resources on retries."
 *
 * @param prefix - Optional prefix for debugging (e.g., 'mtg', 'pipe')
 * @returns A unique token string
 */
export function generateClientRequestToken(prefix?: string): string {
  const token = randomUUID();
  return prefix ? `${prefix}-${token}` : token;
}

/**
 * Generate a unique meeting external ID.
 * Used to correlate Chime meetings with internal call sessions.
 */
export function generateMeetingExternalId(
  locationId: string,
  callerId: string,
): string {
  const timestamp = Date.now();
  return `gw-${locationId}-${callerId}-${timestamp}`;
}
