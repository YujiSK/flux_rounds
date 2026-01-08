// src/App.tsx
import React from "react";
import GameView from "./components/GameView";
import { newGame } from "./game/state";

export default function App() {
  const [state, setState] = React.useState(() =>
    newGame({
      playerNames: ["Player 1", "Player 2"],
      startDiscard: true,
    })
  );

  return <GameView state={state} setState={setState} />;
}
