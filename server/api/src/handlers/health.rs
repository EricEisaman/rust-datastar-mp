use axum::response::Json;
use axum::http::StatusCode;
use serde_json::json;

pub async fn health_check() -> impl axum::response::IntoResponse {
    (StatusCode::OK, Json(json!({"status": "ok"})))
}

