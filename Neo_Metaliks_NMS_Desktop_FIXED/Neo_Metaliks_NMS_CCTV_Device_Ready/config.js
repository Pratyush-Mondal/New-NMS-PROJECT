window.APP_CONFIG = {
    API_BASE_URL: (window.location.protocol === "file:")
        ? "http://127.0.0.1:8000"
        : (window.location.hostname.includes("vercel.app")
            ? "https://neo-metaliks-nms.onrender.com"
            : (window.location.protocol === "https:" || window.location.port === "8081" || !window.location.port ? "" : "http://" + window.location.hostname + ":8000"))
};
