(function() {
    function resolveApiBase() {
        if (window.location.protocol === "file:") {
            return "http://127.0.0.1:8000";
        }
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
            return window.location.port === "8081" ? "" : "http://" + window.location.hostname + ":8000";
        }
        if (window.location.hostname.includes("trycloudflare.com")) {
            return "";
        }
        if (window.location.hostname.includes("onrender.com")) {
            return "";
        }
        if (window.location.hostname.includes("vercel.app")) {
            return "https://neo-metaliks-nms.onrender.com";
        }
        return "";
    }

    window.APP_CONFIG = {
        API_BASE_URL: resolveApiBase()
    };
})();

