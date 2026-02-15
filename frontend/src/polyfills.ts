/**
 * Node.js polyfills required by amazon-chime-sdk-js and @aws-sdk/* in the browser.
 * This file must load BEFORE the main application.
 */
import { Buffer } from 'buffer';

// Expose globals that the Chime SDK and AWS SDK expect
(window as any).global = globalThis;
(window as any).Buffer = Buffer;
(window as any).process = (window as any).process || { env: {} };
