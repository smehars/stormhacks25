import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const PomodoroTimer = forwardRef((props, ref) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes  
  const [isRunning, setIsRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const intervalRef = useRef(null);

  // Timer configurations
  const WORK_TIME = 25 * 60; // 25 minutes

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startTimer: () => {
      console.log("Starting timer via gesture control");
      setIsRunning(true);
    },
    stopTimer: () => setIsRunning(false),
    resetTimer: () => {
      setIsRunning(false);
      setTimeLeft(WORK_TIME);
    },
    isTimerRunning: () => isRunning
  }));

  // Timer logic
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimerComplete();
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning, timeLeft]);

  // Alert logic
  const handleTimerComplete = () => {
    setIsRunning(false);
    const newCycles = cycles + 1;
    setCycles(newCycles);
    setShowAlert(true);
    setTimeLeft(WORK_TIME);
  };

  const closeAlert = () => {
    setShowAlert(false);
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
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    return timeLeft < 5 ? "text-red-400" : "text-emerald-400";
  };

  const getProgressPercentage = () => {
    return ((WORK_TIME - timeLeft) / WORK_TIME) * 100;
  };

  return (
    <>
      {/* Alert modal remains the same */}
      {showAlert && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[9999] animate-in fade-in-0 duration-300">
          <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-blue-400/10 rounded-2xl blur-lg"></div>

            <div className="relative">
              <div className="text-center mb-5">
                <div className="relative mx-auto w-16 h-16 mb-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full animate-pulse"></div>
                  <div className="relative w-full h-full bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center shadow-xl">
                    <svg className="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent mb-2">
                  Session Complete! 🍅
                </h2>

                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  Great work! You've completed <span className="font-bold text-emerald-400">{cycles}</span> session{cycles > 1 ? "s" : ""} today.
                </p>

                <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 border border-slate-600/50 rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-blue-400 font-medium text-sm">Take a Break</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">Stretch, hydrate, and rest your eyes.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={closeAlert}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white border-0 shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 h-10 text-sm font-medium"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Perfect!
                </Button>

                <Button
                  onClick={() => {
                    closeAlert();
                    startTimer();
                  }}
                  variant="outline"
                  className="w-full bg-slate-800/50 border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:text-white hover:border-slate-500 transition-all duration-300 h-9 text-sm"
                >
                  <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timer Component - rest remains the same */}
      <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 min-w-[280px] shadow-2xl">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <Badge variant="outline" className="bg-slate-800/60 border-emerald-500/30 text-emerald-400 px-3 py-1">
              Focus Session
            </Badge>
          </div>

          <div className={`text-5xl font-mono font-bold ${getTimerColor()} mb-4 transition-colors duration-500`}>
            {formatTime(timeLeft)}
          </div>

          <div className="relative w-full bg-slate-700/50 rounded-full h-3 mb-4 overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full transition-all duration-1000 ease-out shadow-lg"
              style={{ width: `${getProgressPercentage()}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-full"></div>
          </div>

          <div className="flex justify-between items-center text-slate-400 text-sm">
            <span>Sessions: {cycles}</span>
            <span className={`${isRunning ? "text-emerald-400" : "text-slate-500"} transition-colors`}>
              {isRunning ? "Active" : "Paused"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Button
            onClick={startTimer}
            disabled={isRunning}
            variant="outline"
            size="sm"
            className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 h-10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </Button>

          <Button
            onClick={stopTimer}
            disabled={!isRunning}
            variant="outline"
            size="sm"
            className="bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 h-10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Button>

          <Button
            onClick={resetTimer}
            variant="outline"
            size="sm"
            className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-400/50 transition-all duration-200 h-10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </Button>
        </div>
      </div>
    </>
  );
});

export default PomodoroTimer;
