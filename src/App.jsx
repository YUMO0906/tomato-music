import { useState, useEffect, useRef } from "react";
import YouTube from "react-youtube";

const API_KEY = "AIzaSyAa8Lz7Aq7-2jiiQh-uoe1B-dWGTynPxtU";

export default function App() {
  /* ------------- 狀態 ---------------- */
  const [playlistUrl, setPlaylistUrl] = useState("");
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

  /* ------------- ref ---------------- */
  const playerRef = useRef(null); // YouTube Player 實體
  const timerRef = useRef(null); // setInterval handler
  const notifyLock = useRef(false); // 防止同一輪重複通知

  /* ---------------- 工具函式 ---------------- */
  const safePause = () => playerRef.current?.pauseVideo?.();
  const safeLoad = (id) => playerRef.current?.loadVideoById?.(id);
  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  /* ---------------- 時鐘顯示 ---------------- */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentDate(now.toLocaleDateString());
      setCurrentTime(now.toLocaleTimeString());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* -------------- 啟用通知權限 -------------- */
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

/* ---------------- 倒計時 ---------------- */
useEffect(() => {
  if (!isRunning) return;                 // 沒在跑就不設 interval

  timerRef.current = setInterval(() => {
    setSeconds((prev) => {
      if (prev > 1) return prev - 1;      // 繼續倒數

      /* ======== 時間到：收尾 ======== */
      clearInterval(timerRef.current);
      timerRef.current = null;
      setIsRunning(false);
      safePause();                        // 停止音樂
      setPomodoroCount((c) => c + 1);     // 完成次數 +1

      /* ======== 通知邏輯 ======== */
      const vibrate = () => navigator.vibrate?.(200);
      const sendDesktop = () =>
        new Notification("番茄鐘結束 ⏰", { body: "請休息五分鐘 🌿" });

      let desktopSent = false;

      // 1️⃣ 嘗試桌面通知
      if (typeof Notification !== "undefined") {
        if (Notification.permission === "granted") {
          sendDesktop();
          desktopSent = true;
        } else if (Notification.permission === "default") {
          Notification.requestPermission().then((p) => {
            if (p === "granted") {
              sendDesktop();
              desktopSent = true;
            }
          });
        }
      }

      // 2️⃣ 備援：被封鎖或不支援
      if (!desktopSent) {
        alert("番茄鐘結束 ⏰\n請休息五分鐘 🌿");    // 阻擋式彈窗

        try {                                     // 音效（放 public/ding.mp3）
          new Audio("/ding.mp3").play();
        } catch {}

        // 頁籤標題閃爍 5 秒
        const origTitle = document.title;
        let flip = false;
        const blinkId = setInterval(() => {
          document.title = flip ? "⏰ 番茄鐘結束！" : origTitle;
          flip = !flip;
        }, 1000);
        setTimeout(() => {
          clearInterval(blinkId);
          document.title = origTitle;
        }, 5000);
      }

      // 3️⃣ 震動（行動裝置）
      vibrate();

      /* 回傳下一輪秒數，重啟倒計時 */
      return workMinutes * 60 + workSeconds;
    });
  }, 1000);

  // 清理 interval
  return () => clearInterval(timerRef.current);
}, [isRunning, workMinutes, workSeconds]);


  /* ----------- 解析 YouTube 網址 ----------- */
  const extractVideoOrPlaylist = (url) => {
    try {
      const u = new URL(url);
      const list = u.searchParams.get("list");
      const vid = u.searchParams.get("v");
      if (list) return { type: "playlist", id: list };
      if (vid) return { type: "single", id: vid };
    } catch {
      const listMatch = url.match(/list=([\w-]+)/);
      if (listMatch) return { type: "playlist", id: listMatch[1] };
      const vidMatch = url.match(/v=([\w-]+)/);
      if (vidMatch) return { type: "single", id: vidMatch[1] };
    }
    return { type: null, id: "" };
  };

  /* ----------- 讀取整個播放清單 ----------- */
  const fetchAllPlaylistItems = async (pid) => {
    let videos = [], next = "";
    try {
      do {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&pageToken=${next}&playlistId=${pid}&key=${API_KEY}`
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        videos.push(
          ...data.items.map((i) => ({
            videoId: i.snippet.resourceId.videoId,
            title: i.snippet.title,
          }))
        );
        next = data.nextPageToken ?? "";
      } while (next);
    } catch (e) {
      alert("❗ 載入播放清單失敗：" + e.message);
    }
    return videos;
  };

  /* ---------------- 送出網址 ---------------- */
  const handlePlaylistSubmit = async () => {
    const { type, id } = extractVideoOrPlaylist(playlistUrl);
    if (!id) return alert("❗ 無法解析影片或播放清單網址");

    if (type === "playlist") {
      const list = await fetchAllPlaylistItems(id);
      if (!list.length) return;
      setVideoList(list);
      setCurrentIndex(0);
      safeLoad(list[0].videoId);
      setIsPlaying(true);
    } else if (type === "single") {
      setVideoList([{ videoId: id, title: "🎵 單曲播放" }]);
      setCurrentIndex(0);
      safeLoad(id);
      setIsPlaying(true);
    }
  };

  /* ---------------- 播放控制 ---------------- */
  const handlePlay = (idx) => {
    setCurrentIndex(idx);
    safeLoad(videoList[idx].videoId);
    setIsPlaying(true);
  };

  const handleNext = () => {
    if (!videoList.length) return;
    const nextIdx =
      playMode === "random"
        ? Math.floor(Math.random() * videoList.length)
        : (currentIndex + 1) % videoList.length;
    handlePlay(nextIdx);
  };

  const handlePrev = () => {
    if (!videoList.length) return;
    const prevIdx = (currentIndex - 1 + videoList.length) % videoList.length;
    handlePlay(prevIdx);
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">番茄鐘音樂播放機</h1>
      <div className="text-sm text-gray-500">📅 {currentDate}｜🕒 {currentTime}</div>

      {/* 輸入網址 */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="貼上影片或播放清單連結..."
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
        <button
          onClick={handlePlaylistSubmit}
          className="bg-green-500 text-white px-4 rounded-full hover:scale-105 active:scale-95 transition shadow-lg"
        >
          載入
        </button>
      </div>

      {/* 設定番茄鐘 */}
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

      {/* 計時控制 */}
      <div className="flex flex-wrap gap-4 justify-center mt-2">
        <button
          onClick={() => setIsRunning((p) => !p)}
                    className="bg-blue-500 text-white px-6 py-2 rounded-full text-lg font-bold hover:scale-105 active:scale-95 transition shadow-lg"
        >
          {isRunning ? "暫停計時" : "開始計時"}
        </button>
        <button
          onClick={() => {
            setIsRunning(false);
            setSeconds(workMinutes * 60 + workSeconds);
            safePause();
            setIsPlaying(false);
            notifyLock.current = false;
          }}
          className="bg-red-500 text-white px-6 py-2 rounded-full text-lg font-bold hover:scale-105 active:scale-95 transition shadow-lg"
        >
          重設
        </button>
      </div>

      <div className="text-center text-gray-600">
        🎯 今日完成番茄鐘：{pomodoroCount}
      </div>

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
              opts={{
                height: "150",
                width: "100%",
                playerVars: { autoplay: 1 },
              }}
              onReady={(e) => (playerRef.current = e.target)}
              onEnd={handleNext}
              onError={() => {
                alert("⚠️ 該影片無法播放，自動跳下一首");
                handleNext();
              }}
            />
          )}

          <ul className="mt-4 space-y-2">
            {videoList.map((video, idx) => (
              <li key={video.videoId}>
                <button
                  onClick={() => handlePlay(idx)}
                  className={`w-full text-left p-2 rounded transition ${
                    idx === currentIndex
                      ? "bg-yellow-100"
                      : "hover:bg-gray-100"
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
