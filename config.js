(function() {
    function resolveApiBase() {
        // When loaded over HTTP/HTTPS (via localhost, 0.0.0.0, any LAN IP, or Cloud domain):
        // Returning "" makes all API calls relative, automatically matching whichever host/IP the browser is on!
        if (window.location.protocol === "http:" || window.location.protocol === "https:") {
            if (window.location.port === "8000" || window.location.port === "8081" || !window.location.port) {
                return "";
            }
            return window.location.protocol + "//" + window.location.hostname + ":8000";
        }
        // Fallback for file:/// protocol
        return "http://127.0.0.1:8000";
    }

    window.APP_CONFIG = {
        API_BASE_URL: resolveApiBase(),
        CLOUD_BACKUP_URL: "https://neo-metaliks-nms.onrender.com"
    };
})();
