"use client";

import { Message, Realtime, RealtimeChannel } from 'ably';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { createAblyClient } from '@/utils/ably';

interface ClockMessage {
  type: "ready" | "update" | "reset";
  payload?: {
    timers?: number[];
    readyStates?: boolean[];
    activeIndex?: number | null;
  };
}

export function GameRoom() {
  const { roomId } = useParams();
  const searchParams = useSearchParams();
  const playersParam = searchParams.get("players");
  const minutesParam = searchParams.get("minutes");

  const numPlayers = playersParam
    ? Math.min(Math.max(Number(playersParam), 2), 10)
    : 2;
  const minutes = minutesParam
    ? Math.min(Math.max(Number(minutesParam), 1), 60)
    : 5;
  const INITIAL_TIME = minutes * 60; // seconds

  const [playerNames, setPlayerNames] = useState(() =>
    Array(numPlayers)
      .fill("")
      .map((_, i) => `Player ${i + 1}`)
  );
  const [readyStates, setReadyStates] = useState(() =>
    Array(numPlayers).fill(false)
  );
  const [timers, setTimers] = useState(() =>
    Array(numPlayers).fill(INITIAL_TIME)
  );
  const ablyRef = useRef<Realtime | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const startClock = (index: number) => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimers((prev) => {
        const newTimers = [...prev];
        newTimers[index] = Math.max(0, newTimers[index] - 1);

        channelRef.current?.publish("message", {
          type: "update",
          payload: { timers: newTimers },
        });

        return newTimers;
      });
    }, 1000);
  };

  const stopClock = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const updateName = (index: number, newName: string) => {
    const updated = [...playerNames];
    updated[index] = newName;
    setPlayerNames(updated);
  };

  useEffect(() => {
    const ably = createAblyClient();
    ablyRef.current = ably;

    const channel = ably.channels.get(`room-${roomId}`);
    channelRef.current = channel;

    const onMessage = (msg: Message) => {
      const data = msg.data as ClockMessage;

      switch (data.type) {
        case "ready":
          if (Array.isArray(data.payload?.readyStates)) {
            const newReady = data.payload.readyStates;
            setReadyStates(newReady);

            const notReadyIndices = newReady
              .map((r, i) => (r ? null : i))
              .filter((i) => i !== null) as number[];

            if (notReadyIndices.length === 1) {
              // One unready player – start their countdown
              const target = notReadyIndices[0];
              startClock(target);
            } else if (notReadyIndices.length === 0) {
              // All ready – stop timers and reset
              stopClock();
              setReadyStates(Array(numPlayers).fill(false));
              channelRef.current?.publish("message", {
                type: "reset",
                payload: {
                  readyStates: Array(numPlayers).fill(false),
                },
              });
            } else {
              stopClock();
            }
          }
          break;

        case "update":
          if (Array.isArray(data.payload?.timers)) {
            setTimers(data.payload.timers);
          }
          break;

        case "reset":
          stopClock();
          setReadyStates(Array(numPlayers).fill(false));
          break;
      }
    };

    channel.subscribe("message", onMessage);

    return () => {
      channel.unsubscribe("message", onMessage);

      if (timerRef.current) clearInterval(timerRef.current);
      const connectionState = ably.connection.state;
      if (connectionState === "connected") {
        console.log("connectionState :>> ", connectionState);
        try {
          ably.close();
        } catch (err) {
          console.warn("Ably close error:", err);
        }
      }
    };
  }, [roomId]);

  const toggleReady = (index: number) => {
    const updated = [...readyStates];
    updated[index] = !updated[index];
    setReadyStates(updated);

    channelRef.current?.publish("message", {
      type: "ready",
      payload: { readyStates: updated },
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Room: {roomId}</h1>
      <div className="grid grid-cols-2 gap-4">
        {playerNames.map((name, i) => {
          const isReady = readyStates[i];
          const bgColor = isReady ? "bg-green-600" : "bg-orange-500";

          return (
            <button
              key={i}
              onClick={() => toggleReady(i)}
              className={`p-4 rounded-xl shadow text-white transition-all duration-300 ${bgColor} cursor-pointer`}
            >
              <div className="flex flex-col items-center">
                <input
                  value={name}
                  onChange={(e) => updateName(i, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent text-white text-xl font-bold text-center outline-none border-b border-white placeholder-white max-w-full truncate"
                  placeholder={`Player ${i + 1}`}
                />

                <div className="text-2xl mt-2">{formatTime(timers[i])}</div>

                <div className="mt-1 text-sm opacity-80">
                  {isReady ? "Ready" : "Not Ready"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => {
          stopClock();
          setTimers(Array(numPlayers).fill(INITIAL_TIME));
          setReadyStates(Array(numPlayers).fill(false));
          channelRef.current?.publish("message", {
            type: "reset",
            payload: {
              timers: Array(numPlayers).fill(INITIAL_TIME),
              readyStates: Array(numPlayers).fill(false),
            },
          });
        }}
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Restart Timer
      </button>
    </div>
  );
}
