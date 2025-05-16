"use client";
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CreateRoom() {
  const router = useRouter();
  const [numPlayers, setNumPlayers] = useState(2);
  const [minutes, setMinutes] = useState(5);

  const createRoom = () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    router.push(
      `/boardgame-clock/room/${roomId}?players=${numPlayers}&minutes=${minutes}`
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <label>
        Number of players:
        <input
          type="number"
          min={2}
          max={10}
          value={numPlayers}
          onChange={(e) => setNumPlayers(Number(e.target.value))}
          className="ml-2 border rounded px-2 py-1 w-16 text-center"
        />
      </label>

      <label>
        Minutes per player:
        <input
          type="number"
          min={1}
          max={60}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="ml-2 border rounded px-2 py-1 w-16 text-center"
        />
      </label>

      <button
        onClick={createRoom}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Create Room
      </button>
    </div>
  );
}
