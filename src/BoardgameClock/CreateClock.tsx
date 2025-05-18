"use client";
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CreateClock() {
  const router = useRouter();
  const [numPlayers, setNumPlayers] = useState<string>("2");
  const [minutes, setMinutes] = useState<string>("5");

  const createRoom = () => {
    if (!numPlayers || !minutes) {
      alert("Please fill in all fields.");
      return;
    }
    const parsedNumPlayers = parseInt(numPlayers);
    const parsedMinutes = parseInt(minutes);
    if (isNaN(parsedNumPlayers) || isNaN(parsedMinutes)) {
      alert("Please enter valid numbers.");
      return;
    }
    if (parsedNumPlayers < 2 || parsedNumPlayers > 10) {
      alert("Number of players must be between 2 and 10.");
      return;
    }
    if (parsedMinutes < 1) {
      alert("Minutes per player must be at least 1.");
      return;
    }
    const roomId = Math.random().toString(36).substring(2, 8);
    router.push(
      `/boardgame-clock/room/${roomId}?players=${numPlayers}&minutes=${minutes}`
    );
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setNumPlayers(e.target.value);
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setMinutes(e.target.value);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <label>
        Number of players:
        <input
          type="text"
          value={numPlayers ?? ""}
          onChange={handleNumberChange}
          className="ml-2 border rounded px-2 py-1 w-16 text-center"
        />
      </label>

      <label>
        Minutes per player:
        <input
          type="text"
          value={minutes}
          onChange={handleMinutesChange}
          className="ml-2 border rounded px-2 py-1 w-16 text-center"
        />
      </label>
      <button
        onClick={createRoom}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
      >
        Create Room
      </button>
    </div>
  );
}
