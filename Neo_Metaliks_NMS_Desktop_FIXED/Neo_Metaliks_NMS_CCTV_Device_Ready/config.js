window.APP_CONFIG = {
    API_BASE_URL: (window.location.protocol === "file:")
        ? "http://127.0.0.1:8000"
        : (window.location.protocol === "https:" || window.location.port === "8081" || !window.location.port ? "" : "http://" + window.location.hostname + ":8000")
};
