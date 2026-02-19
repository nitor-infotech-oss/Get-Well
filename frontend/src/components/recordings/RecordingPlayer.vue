<template>
  <div class="recording-player">
    <div ref="videoContainerRef" class="video-container" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const props = defineProps<{
  segments: { url: string; order: number }[];
}>();

const videoContainerRef = ref<HTMLDivElement | null>(null);
let player: ReturnType<typeof videojs> | null = null;

function initPlayer() {
  if (!videoContainerRef.value || props.segments.length === 0) return;

  const videoEl = document.createElement('video-js');
  videoEl.classList.add('vjs-big-play-centered', 'vjs-fluid');
  videoContainerRef.value.appendChild(videoEl);

  player = videojs(videoEl, {
    controls: true,
    autoplay: false,
    preload: 'auto',
    fluid: true,
    responsive: true,
    playbackRates: [0.5, 1, 1.25, 1.5],
  });

  let currentIndex = 0;
  const p = player;

  function loadSegment(index: number) {
    if (!p || p.isDisposed() || index >= props.segments.length) return;
    const seg = props.segments[index];
    if (!seg || !seg.url) return;

    p.src({ type: 'video/mp4', src: seg.url });
    currentIndex = index;
  }

  p.one('loadedmetadata', () => {
    if (!p.isDisposed()) p.play()?.catch(() => {});
  });

  p.on('ended', () => {
    if (!p.isDisposed() && currentIndex + 1 < props.segments.length) {
      loadSegment(currentIndex + 1);
    }
  });

  loadSegment(0);
}

function disposePlayer() {
  if (player && !player.isDisposed()) {
    player.dispose();
    player = null;
  }
  if (videoContainerRef.value) {
    videoContainerRef.value.innerHTML = '';
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
}

.video-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
}

.video-container :deep(.vjs-fluid) {
  padding-top: 0;
}

.video-container :deep(.video-js) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
