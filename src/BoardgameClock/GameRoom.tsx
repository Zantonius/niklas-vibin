"use client";

import { Message, Realtime, RealtimeChannel } from 'ably';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { createAblyClient } from '@/utils/ably';

type ClockMessage =
  | {
      type: "ready" | "update" | "reset";
      payload?: {
        timers?: number[];
        readyStates?: boolean[];
        activeIndex?: number | null;
      };
    }
  | {
      type: "request_config";
    }
  | {
      type: "config";
      payload: {
        numPlayers: number;
        minutes: number;
        playerNames: string[];
        timers: number[]; // <-- add timers here
        readyStates: boolean[];
      };
    }
  | {
      type: "name_update";
      payload: {
        playerNames: string[];
      };
    };

export function GameRoom() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const playersParam = searchParams.get("players");
  const minutesParam = searchParams.get("minutes");

  const [numPlayers, setNumPlayers] = useState(() =>
    playersParam ? Math.min(Math.max(Number(playersParam), 2), 10) : 2
  );
  const [minutes, setMinutes] = useState(() =>
    minutesParam ? Math.min(Math.max(Number(minutesParam), 1), 60) : 5
  );
  const INITIAL_TIME = minutes * 60;

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
  const hasReceivedConfigRef = useRef(false);
  const isOwner = playersParam !== null && minutesParam !== null;

  const timersRef = useRef(timers);
  const playerNamesRef = useRef(playerNames);
  const readyStatesRef = useRef(readyStates);

  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  useEffect(() => {
    playerNamesRef.current = playerNames;
  }, [playerNames]);

  useEffect(() => {
    readyStatesRef.current = readyStates;
  }, [readyStates]);

  const startClock = (index: number) => {
    if (timerRef.current) return; // Don't start again if already ticking

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
    channelRef.current?.publish("message", {
      type: "name_update",
      payload: { playerNames: updated },
    });
  };

  useEffect(() => {
    hasReceivedConfigRef.current = false;
    const ably = createAblyClient();
    ablyRef.current = ably;

    const channel = ably.channels.get(`room-${id}`);
    channelRef.current = channel;

    const onMessage = (msg: Message) => {
      const data = msg.data as ClockMessage;

      switch (data.type) {
        case "ready": {
          const newReady = data.payload?.readyStates;
          if (Array.isArray(newReady)) {
            setReadyStates(newReady);
            const notReadyIndices = newReady
              .map((r, i) => (r ? null : i))
              .filter((i) => i !== null) as number[];
            if (isOwner && notReadyIndices.length === 1) {
              startClock(notReadyIndices[0]);
            } else if (notReadyIndices.length === 0) {
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
        }

        case "update":
          if (Array.isArray(data.payload?.timers)) {
            setTimers(data.payload.timers);
          }
          break;

        case "reset":
          stopClock();
          setReadyStates(Array(numPlayers).fill(false));
          break;

        case "request_config":
          if (isOwner) {
            console.log("[OWNER] Received request_config, sending full state");
            channel.publish("message", {
              type: "config",
              payload: {
                numPlayers,
                minutes,
                playerNames: playerNamesRef.current,
                timers: timersRef.current,
                readyStates: readyStatesRef.current,
              },
            });
          }
          break;

        case "config":
          if (!isOwner && data.payload && !hasReceivedConfigRef.current) {
            const {
              numPlayers: np,
              minutes: m,
              playerNames: names,
              timers: ts,
              readyStates: rs,
            } = data.payload;

            console.log("[JOINER] Received config:", data.payload);

            setNumPlayers(np);
            setMinutes(m);
            setPlayerNames(
              names ??
                Array(np)
                  .fill("")
                  .map((_, i) => `Player ${i + 1}`)
            );
            setTimers(ts ?? Array(np).fill(m * 60));
            setReadyStates(rs ?? Array(np).fill(false));

            hasReceivedConfigRef.current = true;
          }
          break;

        case "name_update":
          if (Array.isArray(data.payload?.playerNames)) {
            setPlayerNames(data.payload.playerNames);
          }
          break;
      }
    };

    channel.subscribe("message", onMessage);

    // Request config only after subscription established
    if (!isOwner) {
      setTimeout(() => {
        console.log("[JOINER] Sending request_config");
        channel.publish("message", { type: "request_config" });
      }, 300);
    }

    return () => {
      channel.unsubscribe("message", onMessage);

      if (timerRef.current) clearInterval(timerRef.current);

      if (ably.connection.state === "connected") {
        try {
          ably.close();
        } catch (err) {
          console.warn("Ably close error:", err);
        }
      }
    };
  }, [id]);

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
      <h1 className="text-2xl font-bold">
        Room URL: https://niklas-vibin.vercel.app/boardgame-clock/room/{id}
      </h1>
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
      {isOwner && (
        <button
          onClick={() => {
            stopClock();
            const resetTimers = Array(numPlayers).fill(minutes * 60);
            setTimers(resetTimers);
            setReadyStates(Array(numPlayers).fill(false));
            channelRef.current?.publish("message", {
              type: "reset",
              payload: {
                timers: resetTimers,
                readyStates: Array(numPlayers).fill(false),
              },
            });
          }}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Restart Timer
        </button>
      )}
    </div>
  );
}
