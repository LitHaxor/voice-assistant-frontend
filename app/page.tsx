"use client";

import { CloseIcon } from "@/components/CloseIcon";
import { NoAgentNotification } from "@/components/NoAgentNotification";
import TranscriptionView from "@/components/TranscriptionView";
import {
  BarVisualizer,
  DisconnectButton,
  RoomAudioRenderer,
  RoomContext,
  VideoTrack,
  VoiceAssistantControlBar,
  useVoiceAssistant,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { Room, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useState } from "react";
import type { ConnectionDetails } from "./api/connection-details/route";

export default function Page() {
  const [room] = useState(new Room());
  const [isConnecting, setIsConnecting] = useState(false);

  const connectToRoom = useCallback(async () => {
    // Create searchParams inside the callback to avoid dependencies changing on every render
    const searchParams = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    if (isConnecting) return;
    setIsConnecting(true);

    try {
      // Generate room connection details, including:
      //   - A random Room name
      //   - A random Participant name
      //   - An Access Token to permit the participant to join the room
      //   - The URL of the LiveKit server to connect to

      const url = new URL(
        process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details",
        typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
      );
      url.searchParams.set("metadata", searchParams.get("metadata") ?? "{}");
      url.searchParams.set(
        "userId",
        searchParams.get("userId") ?? `participant_${Math.floor(Math.random() * 10_000)}`
      );
      url.searchParams.set(
        "roomName",
        searchParams.get("roomName") ?? `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`
      );
      url.searchParams.set("agentName", searchParams.get("agentName") ?? "private_vm");
      const response = await fetch(url.toString());
      const connectionDetailsData: ConnectionDetails = await response.json();

      await room.connect(connectionDetailsData.serverUrl, connectionDetailsData.participantToken);
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (error) {
      console.error("Failed to connect to room:", error);
    } finally {
      setIsConnecting(false);
    }
  }, [room, isConnecting]);

  useEffect(() => {
    // Connect to room automatically when the component mounts
    if (typeof window !== "undefined") {
      connectToRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    room.on(RoomEvent.MediaDevicesError, onDeviceFailure);

    return () => {
      room.off(RoomEvent.MediaDevicesError, onDeviceFailure);
    };
  }, [room]);

  return (
    <main
      data-lk-theme="default"
      className="h-screen flex items-center justify-center bg-[#343333]"
    >
      <RoomContext.Provider value={room}>
        <div className="lk-room-container max-w-[1024px] w-full mx-auto h-full bg-[#343333]">
          <SimpleVoiceAssistant />
        </div>
      </RoomContext.Provider>
    </main>
  );
}

function SimpleVoiceAssistant() {
  const { state: agentState } = useVoiceAssistant();

  return (
    <AnimatePresence mode="wait">
      {agentState === "disconnected" ? (
        <motion.div
          key="disconnected"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.09, 1.04, 0.245, 1.055] }}
          className="grid items-center justify-center h-full bg-[#343333]"
        >
          {/* Auto-connecting indicator rather than a button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="text-white text-center"
          >
            Connecting to voice assistant...
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key="connected"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: [0.09, 1.04, 0.245, 1.055] }}
          className="flex flex-col items-center gap-4 h-full bg-[#343333]"
        >
          <AgentVisualizer />
          <div className="flex-1 w-full min-h-0">
            <TranscriptionView />
          </div>
          <div className="w-full relative z-20" style={{ transform: "translateZ(0)" }}>
            <ControlBar />
          </div>
          <RoomAudioRenderer />
          <NoAgentNotification state={agentState} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AgentVisualizer() {
  const { state: agentState, videoTrack, audioTrack } = useVoiceAssistant();

  if (videoTrack) {
    return (
      <div className="h-[512px] w-[512px] rounded-lg overflow-hidden">
        <VideoTrack trackRef={videoTrack} />
      </div>
    );
  }
  return (
    <div className="h-[300px] w-full bg-[#343333]">
      <BarVisualizer
        state={agentState}
        barCount={5}
        trackRef={audioTrack}
        className="agent-visualizer bg-[#343333]"
        options={{ minHeight: 24 }}
      />
    </div>
  );
}

function ControlBar() {
  const { state: agentState } = useVoiceAssistant();

  return (
    <div className="relative h-[60px] bg-[#343333]">
      {/* Removed button for starting conversation - auto-connects instead */}
      <AnimatePresence>
        {agentState !== "disconnected" && agentState !== "connecting" && (
          <motion.div
            initial={{ opacity: 0, top: "10px" }}
            animate={{ opacity: 1, top: 0 }}
            exit={{ opacity: 0, top: "-10px" }}
            transition={{ duration: 0.4, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="flex h-12 absolute left-1/2 -translate-x-1/2 justify-center items-center bg-[#343333]"
          >
            <VoiceAssistantControlBar controls={{ leave: false }} />
            <DisconnectButton>
              <CloseIcon />
            </DisconnectButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function onDeviceFailure(error: Error) {
  console.error(error);
  alert(
    "Error acquiring camera or microphone permissions. Please make sure you grant the necessary permissions in your browser and reload the tab"
  );
}
