<template>
  <div class="recording-player">
    <div class="videos-wrapper" @click="onVideoAreaClick">
      <video
        ref="videoARef"
        class="segment-video"
        :class="{ active: activeVideo === 'A' }"
        playsinline
        preload="auto"
        @ended="onSegmentEnded"
        @loadedmetadata="onLoadedMetadata"
      />
      <video
        ref="videoBRef"
        class="segment-video"
        :class="{ active: activeVideo === 'B' }"
        playsinline
        preload="auto"
        @ended="onSegmentEnded"
        @loadedmetadata="onLoadedMetadata"
      />
      <div
        v-show="!hasStartedPlayback"
        class="play-overlay"
        aria-label="Play"
        @click.stop="startPlayback"
      >
        <span class="play-icon">▶</span>
      </div>
    </div>
    <div class="custom-controls">
      <button
        type="button"
        class="control-btn"
        :aria-label="isPlaying ? 'Pause' : 'Play'"
        @click="togglePlay"
      >
        <span v-if="!isPlaying">▶</span>
        <span v-else>⏸</span>
      </button>
      <div
        class="progress-track"
        role="slider"
        :aria-valuenow="currentTime"
        :aria-valuemin="0"
        :aria-valuemax="totalDuration"
        @click="handleProgressClick"
      >
        <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
      </div>
      <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(totalDuration) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';

const props = defineProps<{
  segments: { url: string; order: number }[];
}>();

const videoARef = ref<HTMLVideoElement | null>(null);
const videoBRef = ref<HTMLVideoElement | null>(null);
const activeVideo = ref<'A' | 'B'>('A');
const currentIndex = ref(0);
const isPlaying = ref(false);
const hasStartedPlayback = ref(false);
const segmentDurations = ref<number[]>([]);
const timeUpdateInterval = ref<ReturnType<typeof setInterval> | null>(null);
const segmentIndexByElement = new WeakMap<HTMLVideoElement, number>();

const currentTime = ref(0);
const totalDuration = computed(() => {
  const sum = segmentDurations.value.reduce((a, b) => a + b, 0);
  return sum > 0 ? sum : (props.segments.length * 6); // Fallback: ~6s per segment
});
const progressPercent = computed(() => {
  const total = totalDuration.value;
  return total > 0 ? Math.min(100, (currentTime.value / total) * 100) : 0;
});

function getActiveEl(): HTMLVideoElement | null {
  return activeVideo.value === 'A' ? videoARef.value : videoBRef.value;
}
function getInactiveEl(): HTMLVideoElement | null {
  return activeVideo.value === 'A' ? videoBRef.value : videoARef.value;
}

function loadIntoVideo(
  el: HTMLVideoElement | null,
  url: string,
  index: number,
  seekTo?: number,
  onReady?: () => void,
) {
  if (!el) return;
  segmentIndexByElement.set(el, index);
  const handler = () => {
    if (seekTo != null && seekTo > 0) {
      el.currentTime = seekTo;
    }
    el.removeEventListener('loadeddata', handler);
    onReady?.();
  };
  el.addEventListener('loadeddata', handler);
  el.src = url;
  el.load();
}

function onLoadedMetadata(ev: Event) {
  const v = ev.target as HTMLVideoElement;
  const idx = segmentIndexByElement.get(v);
  if (v.duration && !isNaN(v.duration) && idx != null && idx >= 0 && idx < props.segments.length) {
    segmentDurations.value[idx] = v.duration;
  }
}

function swapVideosAndPlay(nextIndex: number) {
  if (nextIndex >= props.segments.length) {
    isPlaying.value = false;
    return;
  }
  const inactive = getInactiveEl();
  const seg = props.segments[nextIndex];
  if (!inactive || !seg?.url) return;

  currentIndex.value = nextIndex;
  activeVideo.value = activeVideo.value === 'A' ? 'B' : 'A';
  const nowActive = getActiveEl();
  if (nowActive) {
    nowActive.currentTime = 0;
    nowActive.play().catch(() => {});
  }
  const nextNext = nextIndex + 1;
  if (nextNext < props.segments.length) {
    loadIntoVideo(getInactiveEl(), props.segments[nextNext].url, nextNext);
  }
}

function onSegmentEnded() {
  swapVideosAndPlay(currentIndex.value + 1);
}

function startPlayback() {
  hasStartedPlayback.value = true;
  const el = getActiveEl();
  if (el) {
    el.play().catch(() => {});
    isPlaying.value = true;
  }
}

function onVideoAreaClick() {
  if (!hasStartedPlayback.value) return;
  togglePlay();
}

function togglePlay() {
  const el = getActiveEl();
  if (!el) return;
  if (isPlaying.value) {
    el.pause();
  } else {
    el.play().catch(() => {});
  }
  isPlaying.value = !isPlaying.value;
}

function handleProgressClick(ev: MouseEvent) {
  const track = ev.currentTarget as HTMLElement;
  const rect = track.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
  const targetTime = percent * totalDuration.value;

  let acc = 0;
  let segIdx = 0;
  let offset = 0;
  for (let i = 0; i < props.segments.length; i++) {
    const d = segmentDurations.value[i] ?? 6;
    if (acc + d >= targetTime) {
      segIdx = i;
      offset = targetTime - acc;
      break;
    }
    acc += d;
  }

  const seg = props.segments[segIdx];
  const activeEl = getActiveEl();
  if (!activeEl || !seg?.url) return;

  if (segIdx !== currentIndex.value) {
    const inactiveEl = getInactiveEl();
    if (!inactiveEl) return;
    currentIndex.value = segIdx;
    loadIntoVideo(inactiveEl, seg.url, segIdx, offset, () => {
      activeVideo.value = activeVideo.value === 'A' ? 'B' : 'A';
      const nowActive = getActiveEl();
      if (nowActive) {
        nowActive.play().catch(() => {});
        isPlaying.value = true;
      }
    });
    if (segIdx + 1 < props.segments.length) {
      loadIntoVideo(activeEl, props.segments[segIdx + 1].url, segIdx + 1);
    }
  } else {
    activeEl.currentTime = offset;
    if (!isPlaying.value) {
      activeEl.play().catch(() => {});
      isPlaying.value = true;
    }
  }
  currentTime.value = targetTime;
}

function updateCurrentTime() {
  const el = getActiveEl();
  if (!el) return;
  let acc = 0;
  for (let i = 0; i < currentIndex.value; i++) {
    acc += segmentDurations.value[i] ?? 6;
  }
  currentTime.value = acc + el.currentTime;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function initPlayer() {
  if (props.segments.length === 0) return;
  segmentDurations.value = new Array(props.segments.length).fill(0);
  currentIndex.value = 0;
  activeVideo.value = 'A';
  currentTime.value = 0;
  hasStartedPlayback.value = false;

  const seg0 = props.segments[0];
  if (seg0?.url && videoARef.value) {
    loadIntoVideo(videoARef.value, seg0.url, 0);
    if (props.segments.length > 1) {
      loadIntoVideo(videoBRef.value, props.segments[1].url, 1);
    }
    // Prefetch remaining segments to warm cache for seamless playback
    for (let i = 2; i < props.segments.length; i++) {
      const u = props.segments[i]?.url;
      if (u) fetch(u, { mode: 'cors' }).catch(() => {});
    }
  }

  const el = videoARef.value;
  if (el) {
    el.addEventListener('play', () => { isPlaying.value = true; });
    el.addEventListener('pause', () => { isPlaying.value = false; });
    el.addEventListener('timeupdate', updateCurrentTime);
  }
  if (videoBRef.value) {
    videoBRef.value.addEventListener('play', () => { isPlaying.value = true; });
    videoBRef.value.addEventListener('pause', () => { isPlaying.value = false; });
    videoBRef.value.addEventListener('timeupdate', updateCurrentTime);
  }

  timeUpdateInterval.value = setInterval(updateCurrentTime, 250);
}

function disposePlayer() {
  if (timeUpdateInterval.value) {
    clearInterval(timeUpdateInterval.value);
    timeUpdateInterval.value = null;
  }
  const a = videoARef.value;
  const b = videoBRef.value;
  if (a) {
    a.pause();
    a.removeAttribute('src');
    a.load();
    a.removeEventListener('play', () => {});
    a.removeEventListener('pause', () => {});
    a.removeEventListener('timeupdate', updateCurrentTime);
  }
  if (b) {
    b.pause();
    b.removeAttribute('src');
    b.load();
  }
}

onMounted(() => {
  initPlayer();
});

onBeforeUnmount(() => {
  disposePlayer();
});

watch(
  () => props.segments,
  () => {
    disposePlayer();
    initPlayer();
  },
  { deep: true },
);
</script>

<style scoped>
.recording-player {
  width: 100%;
  background: #000;
  color: #fff;
}

.videos-wrapper {
  position: relative;
  width: 100%;
  min-height: 320px;
  aspect-ratio: 16 / 9;
  cursor: pointer;
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  cursor: pointer;
}

.play-icon {
  font-size: 72px;
  color: rgba(255, 255, 255, 0.9);
  opacity: 0.9;
}

.play-overlay:hover .play-icon {
  opacity: 1;
}

.segment-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.05s ease-out;
}

.segment-video.active {
  opacity: 1;
  pointer-events: auto;
}

.custom-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #1a1a1a;
}

.control-btn {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
}

.control-btn:hover {
  color: #4fc3f7;
}

.progress-track {
  flex: 1;
  height: 6px;
  background: #444;
  border-radius: 3px;
  cursor: pointer;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4fc3f7;
  border-radius: 3px;
  transition: width 0.1s linear;
}

.time-display {
  font-size: 13px;
  color: #aaa;
  min-width: 90px;
}
</style>
