import { useState, useEffect, useRef } from "react";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [started, setStarted] = useState(false);

  const [round, setRound] = useState(0);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [options, setOptions] = useState([]);

  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [success, setSuccess] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const playerRef = useRef(null);
  const apiLoadedRef = useRef(false);

  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith(name + "=")) {
          cookieValue = decodeURIComponent(
            cookie.substring(name.length + 1)
          );
          break;
        }
      }
    }
    return cookieValue;
  }

  const loginUser = async () => {
    setError("");
    await fetch("/api/csrf/", { credentials: "include" });

    const res = await fetch("/api/login/", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: new URLSearchParams({ username, password }),
    });

    if (!res.ok) {
      setError("Invalid username or password");
      return;
    }

    setLoggedIn(true);
    start2FA();
  };

  const start2FA = async () => {
    const res = await fetch("/api/2fa/start/", {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      setError("Account blocked, please try again 5 mins later");
      return;
    }

    setStarted(true);
    loadChallenge();
  };

  const loadChallenge = async () => {
    const res = await fetch("/api/2fa/challenge/", {
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Challenge error");
      return;
    }

    setRound(data.round);
    setYoutubeUrl(data.youtube_url);
    setStartTime(data.start_time);
    setOptions(data.options);
  };

  const submitAnswer = async (songId) => {
    const res = await fetch("/api/2fa/answer/", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ song_id: songId }),
    });

    const data = await res.json();

    setCorrect(data.correct);
    setFinished(data.finished);
    setSuccess(data.success);

    if (!data.finished) {
      loadChallenge();
    }
  };

  useEffect(() => {
    if (apiLoadedRef.current) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    apiLoadedRef.current = true;
  }, []);


  useEffect(() => {
    if (!youtubeUrl || !window.YT) return;

    const videoId =
      new URL(youtubeUrl).searchParams.get("v") ||
      youtubeUrl.split("/").pop();

    const playSnippet = () => {
      if (!playerRef.current) {
        playerRef.current = new window.YT.Player("hidden-player", {
          height: "0",
          width: "0",
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
          },
          events: {
            onReady: (event) => {
              event.target.seekTo(startTime);
              event.target.playVideo();
              setTimeout(() => {
                event.target.stopVideo();
              }, 3000);
            },
          },
        });
      } else {
        playerRef.current.loadVideoById({
          videoId: videoId,
          startSeconds: startTime,
        });

        setTimeout(() => {
          playerRef.current.stopVideo();
        }, 3000);
      }
    };

    if (window.YT && window.YT.Player) {
      playSnippet();
    } else {
      window.onYouTubeIframeAPIReady = playSnippet;
    }
  }, [youtubeUrl]);

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.stopVideo();
        } catch (e) {}
      }
    };
  }, []);

  return (
    <div style={styles.page}>
      <div id="hidden-player" style={{ display: "none" }}></div>

      <div style={styles.card}>
        <h1 style={styles.title}>Playlist Passwordmania</h1>
        <p style={styles.subtitle}>
          Music-based Two-Factor Authentication
        </p>

        {error && <div style={styles.error}>{error}</div>}

        {!loggedIn && (
          <>
            <input
              style={styles.input}
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              style={styles.input}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button style={styles.primaryButton} onClick={loginUser}>
              Login & Start 2FA
            </button>
          </>
        )}

        {started && !finished && (
          <>
            <div style={styles.progress}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${(round / 5) * 100}%`,
                }}
              />
            </div>

           

            {options.map((o) => (
              <button
                key={o.id}
                style={styles.optionButton}
                onClick={() => submitAnswer(o.id)}
              >
                {o.title}
              </button>
            ))}
          </>
        )}

        {finished && (
          <div style={styles.result}>
            <h2>
              {success
                ? "Authentication Successful"
                : "Authentication Failed"}
            </h2>
            <button
              style={styles.secondaryButton}
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
  },
  card: {
    background: "#111827",
    padding: 32,
    borderRadius: 12,
    width: 420,
    boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
    textAlign: "center",
  },
  title: { marginBottom: 8 },
  subtitle: { color: "#9ca3af", marginBottom: 24 },
  input: {
    width: "100%",
    padding: 10,
    marginBottom: 10,
    borderRadius: 6,
    border: "none",
  },
  primaryButton: {
    width: "100%",
    padding: 12,
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    marginTop: 8,
  },
  secondaryButton: {
    padding: 10,
    background: "#374151",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  optionButton: {
    width: "100%",
    padding: 10,
    marginTop: 8,
    background: "#1f2933",
    color: "#fff",
    border: "1px solid #374151",
    borderRadius: 6,
    cursor: "pointer",
  },
  progress: {
    height: 6,
    background: "#374151",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    background: "#22c55e",
  },
  info: { marginBottom: 12 },
  error: {
    background: "#7f1d1d",
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  result: { marginTop: 20 },
};