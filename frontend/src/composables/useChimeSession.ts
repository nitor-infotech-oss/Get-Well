import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import type {
  VideoTileState,
  AudioVideoObserver,
} from 'amazon-chime-sdk-js';

/**
 * Composable for Amazon Chime SDK integration.
 *
 * Key design decisions:
 * 1. startLocalVideoTile() is called INSIDE audioVideoDidStart — not before,
 *    because the WebRTC session must be connected first.
 * 2. startVideoPreviewForVideoInput() is NOT used — it conflicts with
 *    startLocalVideoTile() because both try to claim the video track.
 * 3. Video element refs are stored as Vue Refs (not snapshots of .value)
 *    so we always read the latest DOM element, even if it mounts later.
 * 4. After bindVideoElement(), we call element.play() explicitly to handle
 *    browsers that don't honour the autoplay attribute for programmatic srcObject.
 */
export function useChimeSession() {
  const session = ref<any>(null);
  const isMuted = ref(false);
  const isVideoOff = ref(false);
  const isAudioReady = ref(false);
  const isVideoReady = ref(false);
  const error = ref<string | null>(null);
  const remoteVideoTileId = ref<number | null>(null);

  // Store Vue Refs — NOT .value snapshots — so we always get the current element
  let localVideoRef: Ref<HTMLVideoElement | null> | null = null;
  let remoteVideoRef: Ref<HTMLVideoElement | null> | null = null;

  // Pending tile IDs for elements that aren't in the DOM yet
  let pendingLocalTileId: number | null = null;
  let pendingRemoteTileId: number | null = null;

  // Track bound tile IDs to avoid redundant binds for the same active state
  let boundLocalTileId: number | null = null;
  let boundRemoteTileId: number | null = null;

  /**
   * Bind a video tile to a DOM element, then force-play it.
   * Returns true if the bind succeeded.
   */
  function bindTile(
    tileId: number,
    element: HTMLVideoElement | null | undefined,
    label: string,
  ): boolean {
    if (!session.value || !element) return false;
    try {
      session.value.audioVideo.bindVideoElement(tileId, element);
      console.log(`[Chime] Bound ${label} video tile ${tileId}`);

      // Force-play: browsers may ignore autoplay when srcObject is set programmatically
      forcePlay(element, label);
      return true;
    } catch (e: any) {
      console.warn(`[Chime] Failed to bind ${label} tile ${tileId}:`, e.message);
      return false;
    }
  }

  /**
   * Explicitly play a video element. Handles both immediate and delayed srcObject.
   */
  function forcePlay(el: HTMLVideoElement, label: string): void {
    const tryPlay = () => {
      if (el.srcObject) {
        el.play().then(() => {
          console.log(`[Chime] ${label} video playing (${el.videoWidth}x${el.videoHeight})`);
        }).catch((err) => {
          // AbortError is benign (play() interrupted by a new play())
          if (err.name !== 'AbortError') {
            console.warn(`[Chime] ${label} play() error:`, err.name, err.message);
          }
        });
      }
    };

    // Try immediately
    tryPlay();
    // Retry after a short delay (srcObject may be set asynchronously by the SDK)
    setTimeout(tryPlay, 250);
    setTimeout(tryPlay, 1000);
  }

  async function initializeSession(
    meetingResponse: Record<string, any>,
    attendeeResponse: Record<string, any>,
  ): Promise<void> {
    try {
      const ChimeSDK = await import('amazon-chime-sdk-js');

      const logger = new ChimeSDK.ConsoleLogger('ChimeSDK', ChimeSDK.LogLevel.WARN);
      const deviceController = new ChimeSDK.DefaultDeviceController(logger);

      const configuration = new ChimeSDK.MeetingSessionConfiguration(
        meetingResponse,
        attendeeResponse,
      );

      session.value = new ChimeSDK.DefaultMeetingSession(
        configuration,
        logger,
        deviceController,
      );

      // Reset bound tile trackers
      boundLocalTileId = null;
      boundRemoteTileId = null;

      const observer: AudioVideoObserver = {
        audioVideoDidStart: () => {
          console.log('[Chime] audioVideoDidStart — WebRTC session connected');
          isAudioReady.value = true;
          isVideoReady.value = true;

          // NOW start publishing local video into the meeting
          try {
            session.value.audioVideo.startLocalVideoTile();
            console.log('[Chime] startLocalVideoTile() called');
          } catch (e: any) {
            console.warn('[Chime] startLocalVideoTile failed:', e.message);
          }

          // Safety net: after a delay, verify video elements are playing
          setTimeout(() => verifyAndRetryBindings(), 2000);
        },

        audioVideoDidStop: (_sessionStatus: any) => {
          console.log('[Chime] Audio/Video stopped');
          isAudioReady.value = false;
          isVideoReady.value = false;
        },

        videoTileDidUpdate: (tileState: VideoTileState) => {
          if (!session.value || !tileState.tileId) return;

          console.log('[Chime] videoTileDidUpdate', {
            tileId: tileState.tileId,
            localTile: tileState.localTile,
            active: tileState.active,
          });

          if (tileState.localTile) {
            const el = localVideoRef?.value;
            if (el) {
              bindTile(tileState.tileId, el, 'local');
              boundLocalTileId = tileState.tileId;
              pendingLocalTileId = null;
            } else {
              pendingLocalTileId = tileState.tileId;
            }
          } else {
            const el = remoteVideoRef?.value;
            if (el) {
              bindTile(tileState.tileId, el, 'remote');
              boundRemoteTileId = tileState.tileId;
              remoteVideoTileId.value = tileState.tileId;
              pendingRemoteTileId = null;
            } else {
              pendingRemoteTileId = tileState.tileId;
              remoteVideoTileId.value = tileState.tileId;
            }
          }
        },

        videoTileWasRemoved: (tileId: number) => {
          console.log('[Chime] Video tile removed', tileId);
          if (tileId === remoteVideoTileId.value) {
            remoteVideoTileId.value = null;
            pendingRemoteTileId = null;
            boundRemoteTileId = null;
          }
          if (tileId === boundLocalTileId) {
            boundLocalTileId = null;
          }
        },
      };

      session.value.audioVideo.addObserver(observer);

      console.log('[Chime] Session initialized', {
        meetingId: meetingResponse.Meeting?.MeetingId || meetingResponse.MeetingId,
        attendeeId: attendeeResponse.Attendee?.AttendeeId || attendeeResponse.AttendeeId,
      });
    } catch (err: any) {
      error.value = `Failed to initialize Chime session: ${err.message}`;
      console.error('[Chime] Initialization error:', err);
      throw err;
    }
  }

  /**
   * Safety net: verify video elements have srcObject, re-bind if necessary.
   */
  function verifyAndRetryBindings(): void {
    if (!session.value) return;

    const localEl = localVideoRef?.value;
    const remoteEl = remoteVideoRef?.value;

    console.log('[Chime] Verifying bindings:', {
      localSrc: !!localEl?.srcObject,
      localPaused: localEl?.paused,
      localW: localEl?.videoWidth,
      remoteSrc: !!remoteEl?.srcObject,
      remotePaused: remoteEl?.paused,
      remoteW: remoteEl?.videoWidth,
      boundLocal: boundLocalTileId,
      boundRemote: boundRemoteTileId,
    });

    // Re-bind local if needed
    if (localEl && boundLocalTileId) {
      if (!localEl.srcObject || localEl.paused) {
        console.log('[Chime] Re-binding local tile', boundLocalTileId);
        bindTile(boundLocalTileId, localEl, 'local-retry');
      }
    }

    // Re-bind remote if needed
    if (remoteEl && boundRemoteTileId) {
      if (!remoteEl.srcObject || remoteEl.paused) {
        console.log('[Chime] Re-binding remote tile', boundRemoteTileId);
        bindTile(boundRemoteTileId, remoteEl, 'remote-retry');
      }
    }
  }

  /**
   * Select audio/video devices and connect to the meeting.
   */
  async function startAudioVideo(): Promise<void> {
    if (!session.value) {
      error.value = 'Session not initialized';
      return;
    }

    try {
      const av = session.value.audioVideo;

      // Select audio/video input devices
      const audioInputs = await av.listAudioInputDevices();
      const videoInputs = await av.listVideoInputDevices();

      if (audioInputs.length > 0) {
        await av.startAudioInput(audioInputs[0].deviceId);
        console.log('[Chime] Audio input:', audioInputs[0].label);
      }

      if (videoInputs.length > 0) {
        await av.startVideoInput(videoInputs[0].deviceId);
        console.log('[Chime] Video input:', videoInputs[0].label);
      }

      // Bind an <audio> element so the SDK can play received audio from
      // remote participants. Without this, the mic captures fine but nothing
      // is routed to the speakers. The element is created programmatically —
      // it does not need to be visible in the DOM.
      const audioElement = document.createElement('audio');
      audioElement.autoplay = true;
      // Must NOT be muted — this is the speaker output for remote audio
      audioElement.muted = false;
      av.bindAudioElement(audioElement);
      console.log('[Chime] Audio output element bound');

      // Connect to the Chime meeting.
      // audioVideoDidStart fires when connected → calls startLocalVideoTile()
      av.start();
      console.log('[Chime] av.start() — connecting to meeting...');
    } catch (err: any) {
      error.value = `Failed to start audio/video: ${err.message}`;
      console.error('[Chime] Start error:', err);
      throw err;
    }
  }

  function stopAudioVideo(): void {
    if (!session.value) return;
    try {
      session.value.audioVideo.stop();
      session.value = null;
      pendingLocalTileId = null;
      pendingRemoteTileId = null;
      boundLocalTileId = null;
      boundRemoteTileId = null;
      console.log('[Chime] Session stopped');
    } catch (err: any) {
      console.error('[Chime] Stop error:', err);
    }
  }

  function toggleMute(): void {
    if (!session.value) return;
    if (isMuted.value) {
      session.value.audioVideo.realtimeUnmuteLocalAudio();
    } else {
      session.value.audioVideo.realtimeMuteLocalAudio();
    }
    isMuted.value = !isMuted.value;
  }

  async function toggleVideo(): Promise<void> {
    if (!session.value) return;
    if (isVideoOff.value) {
      session.value.audioVideo.startLocalVideoTile();
    } else {
      session.value.audioVideo.stopLocalVideoTile();
    }
    isVideoOff.value = !isVideoOff.value;
  }

  /**
   * Store video element Refs and watch for late-mounting elements.
   */
  function setVideoElements(
    local: Ref<HTMLVideoElement | null>,
    remote: Ref<HTMLVideoElement | null>,
  ): void {
    localVideoRef = local;
    remoteVideoRef = remote;

    // When the remote element mounts (e.g., v-if becomes true), bind pending tile
    watch(remote, (el) => {
      if (el && pendingRemoteTileId && session.value) {
        console.log('[Chime] Remote element appeared — binding tile', pendingRemoteTileId);
        bindTile(pendingRemoteTileId, el, 'remote');
        boundRemoteTileId = pendingRemoteTileId;
        pendingRemoteTileId = null;
      }
    });

    watch(local, (el) => {
      if (el && pendingLocalTileId && session.value) {
        console.log('[Chime] Local element appeared — binding tile', pendingLocalTileId);
        bindTile(pendingLocalTileId, el, 'local');
        boundLocalTileId = pendingLocalTileId;
        pendingLocalTileId = null;
      }
    });
  }

  return {
    session,
    isMuted,
    isVideoOff,
    isAudioReady,
    isVideoReady,
    error,
    initializeSession,
    startAudioVideo,
    stopAudioVideo,
    toggleMute,
    toggleVideo,
    setVideoElements,
  };
}
