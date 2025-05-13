import { useState, useEffect, useRef } from "react";
import YouTube from "react-youtube";

const API_KEY = "AIzaSyAa8Lz7Aq7-2jiiQh-uoe1B-dWGTynPxtU";

export default function App() {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [videoList, setVideoList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [playMode, setPlayMode] = useState("sequential");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [workMinutes, setWorkMinutes] = useState(25);
  const [workSeconds, setWorkSeconds] = useState(0);
  const [seconds, setSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [notified, setNotified] = useState(false);

  const playerRef = useRef(null);
  const notificationRef = useRef(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDate(now.toLocaleDateString());
      setCurrentTime(now.toLocaleTimeString());
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          setIsPlaying(false);
          if (playerRef.current) playerRef.current.internalPlayer.pauseVideo();
          setPomodoroCount((c) => c + 1);
          if (!notificationRef.current && typeof window !== 'undefined') {
            notificationRef.current = true;
            window.navigator.vibrate?.(200);
            new Notification("番茄鐘結束 ⏰", {
              body: "請休息五分鐘 🌿",
            });
          }
          // 自動重設秒數為設定值
          return workMinutes * 60 + workSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, workMinutes, workSeconds]);

  const handleStartPause = () => {
    const total = workMinutes * 60 + workSeconds;
    if (!isRunning && seconds === 0) {
      if (total <= 0) {
        alert("請輸入大於 0 的番茄鐘時間。");
        return;
      }
      setSeconds(total);
      setNotified(false);
      notificationRef.current = false;
    }
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSeconds(workMinutes * 60 + workSeconds);
    if (playerRef.current) playerRef.current.internalPlayer.pauseVideo();
    setIsPlaying(false);
    setNotified(false);
    notificationRef.current = false;
  };
  
  const extractPlaylistId = (url) => {
    try {
      const urlObj = new URL(url);
      const listId = urlObj.searchParams.get("list");
      return listId || "";
    } catch {
      const match = url.match(/list=([a-zA-Z0-9_-]+)/);
      return match ? match[1] : "";
    }
  };

  const fetchAllPlaylistItems = async (playlistId) => {
    let videos = [];
    let nextPageToken = "";
    try {
      do {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&pageToken=${nextPageToken}&playlistId=${playlistId}&key=${API_KEY}`
        );
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        const newItems = data.items.map((item) => ({
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
        }));
        videos = [...videos, ...newItems];
        nextPageToken = data.nextPageToken || "";
      } while (nextPageToken);
      return videos;
    } catch (err) {
      alert("❗ 載入播放清單失敗：" + err.message);
      return [];
    }
  };

  const handlePlaylistSubmit = async () => {
    const id = extractPlaylistId(playlistUrl);
    setPlaylistId(id);
    const allVideos = await fetchAllPlaylistItems(id);
    if (allVideos.length > 0) {
      setVideoList(allVideos);
      setCurrentIndex(0);
      if (playerRef.current) {
        playerRef.current.loadVideoById(allVideos[0].videoId);
        setIsPlaying(true);
      }
    }
  };

  const handlePlay = (index) => {
    setCurrentIndex(index);
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoList[index].videoId);
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    if (videoList.length === 0) return;
    if (playMode === "random") {
      const randomIndex = Math.floor(Math.random() * videoList.length);
      handlePlay(randomIndex);
    } else {
      const nextIndex = (currentIndex + 1) % videoList.length;
      handlePlay(nextIndex);
    }
  };

  const handlePrev = () => {
    if (videoList.length === 0) return;
    const prevIndex = (currentIndex - 1 + videoList.length) % videoList.length;
    handlePlay(prevIndex);
  };

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleEnd = () => {
    handleNext();
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">番茄鐘音樂播放機</h1>
      <div className="text-sm text-gray-500">📅 {currentDate}｜🕒 {currentTime}</div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="貼上播放清單連結..."
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
        <button
          onClick={handlePlaylistSubmit}
          className="bg-green-500 text-white px-4 rounded-full hover:scale-105 active:scale-95 transition shadow-lg"
        >
          載入清單
        </button>
      </div>

      <div className="flex gap-4 flex-wrap">
        <label>
          番茄鐘：
          <input
            type="number"
            min="0"
            value={workMinutes}
            onChange={(e) => setWorkMinutes(Math.max(0, Number(e.target.value)))}
            className="ml-1 w-14 p-1 border rounded"
          />
          分
          <input
            type="number"
            min="0"
            value={workSeconds}
            onChange={(e) => setWorkSeconds(Math.max(0, Number(e.target.value)))}
            className="ml-1 w-14 p-1 border rounded"
          />
          秒
        </label>
      </div>

      <div className="text-4xl font-mono text-center">⏳ {formatTime(seconds)}</div>

      <div className="flex flex-wrap gap-4 justify-center mt-2">
        <button
          onClick={handleStartPause}
          className="bg-blue-500 text-white px-6 py-2 rounded-full text-lg font-bold hover:scale-105 active:scale-95 transition transform duration-150 shadow-lg"
        >
          {isRunning ? "暫停計時" : "開始計時"}
        </button>
        <button
          onClick={handleReset}
          className="bg-red-500 text-white px-6 py-2 rounded-full text-lg font-bold hover:scale-105 active:scale-95 transition transform duration-150 shadow-lg"
        >
          重設
        </button>
      </div>

      <div className="text-center text-gray-600">🎯 今日完成番茄鐘：{pomodoroCount}</div>

      {videoList.length > 0 && (
        <>
          <div className="flex gap-4 mt-4 flex-wrap justify-center">
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium">播放模式：</span>
              <button
                onClick={() => setPlayMode("sequential")}
                className={`px-4 py-1 rounded-full transition shadow-md ${
                  playMode === "sequential"
                    ? "bg-blue-600 text-white scale-105"
                    : "bg-gray-200 hover:scale-105 active:scale-95"
                }`}
              >
                順序播放
              </button>
              <button
                onClick={() => setPlayMode("random")}
                className={`px-4 py-1 rounded-full transition shadow-md ${
                  playMode === "random"
                    ? "bg-blue-600 text-white scale-105"
                    : "bg-gray-200 hover:scale-105 active:scale-95"
                }`}
              >
                隨機播放
              </button>
            </span>
            <button
              onClick={handlePrev}
              className="px-4 py-1 bg-gray-500 text-white rounded-full hover:scale-105 active:scale-95 transition shadow-md"
            >
              ⏮ 上一首
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-1 bg-gray-500 text-white rounded-full hover:scale-105 active:scale-95 transition shadow-md"
            >
              ⏭ 下一首
            </button>
          </div>

          {currentIndex !== null && (
            <YouTube
              videoId={videoList[currentIndex].videoId}
              opts={{ height: "150", width: "100%", playerVars: { autoplay: 1 } }}
              onReady={(e) => (playerRef.current = e.target)}
              onEnd={handleEnd}
              onError={() => {
                alert("⚠️ 該影片無法播放，自動跳下一首");
                handleEnd();
              }}
            />
          )}

          <ul className="mt-4 space-y-2">
            {videoList.map((video, index) => (
              <li key={video.videoId}>
                <button
                  onClick={() => handlePlay(index)}
                  className={`w-full text-left p-2 rounded transition ${
                    index === currentIndex ? "bg-yellow-100" : "hover:bg-gray-100"
                  }`}
                >
                  ▶ {video.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
