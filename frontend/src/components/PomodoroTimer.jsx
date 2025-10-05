import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export default function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const intervalRef = useRef(null);

  // Timer configurations
  const WORK_TIME = 25 * 60; // 25 minutes

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimerComplete();
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning, timeLeft]);

  const handleTimerComplete = () => {
    setIsRunning(false);
    
    // Work session completed
    const newCycles = cycles + 1;
    setCycles(newCycles);
    
    // Show alert popup
    alert(`🍅 Focus session complete!\n\nYou've completed ${newCycles} focus session${newCycles > 1 ? 's' : ''} today.\n\nTime for a break! Great work!`);
    
    // Reset timer for next session
    setTimeLeft(WORK_TIME);
  };

  const startTimer = () => {
    setIsRunning(true);
  };

  const stopTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(WORK_TIME);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    return timeLeft < 5 * 60 ? "text-red-400" : "text-blue-400";
  };

  const getProgressPercentage = () => {
    return ((WORK_TIME - timeLeft) / WORK_TIME) * 100;
  };

  return (
    <div className="bg-black/60 backdrop-blur-sm border border-white/20 rounded-2xl p-4 min-w-[200px]">
      {/* Timer Display */}
      <div className="text-center mb-4">
        <Badge 
          variant="outline" 
          className="mb-2 bg-black/50 border-white/20 text-white"
        >
          🍅 Focus Time
        </Badge>
        
        <div className={`text-3xl font-mono font-bold ${getTimerColor()}`}>
          {formatTime(timeLeft)}
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-white/20 rounded-full h-2 mt-3">
          <div 
            className="h-2 rounded-full transition-all duration-1000 bg-blue-400"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
        
        <div className="text-white/60 text-sm mt-2">
          Sessions completed: {cycles}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={startTimer}
          disabled={isRunning}
          variant="outline"
          size="sm"
          className="flex-1 bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Start
        </Button>
        
        <Button
          onClick={stopTimer}
          disabled={!isRunning}
          variant="outline"
          size="sm"
          className="flex-1 bg-yellow-500/20 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/30"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Stop
        </Button>
        
        <Button
          onClick={resetTimer}
          variant="outline"
          size="sm"
          className="bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Button>
      </div>
    </div>
  );
}