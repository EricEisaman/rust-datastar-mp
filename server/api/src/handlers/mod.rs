pub mod health;
pub mod events;
pub mod chat;
pub mod game;

use axum::response::IntoResponse;

/// Serves index.html for SPA routing fallback
pub async fn serve_index_html() -> axum::response::Response {
    match std::fs::read_to_string("client/dist/index.html") {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => {
            let body = axum::body::Body::from("Not found");
            axum::response::Response::builder()
                .status(axum::http::StatusCode::NOT_FOUND)
                .body(body)
                .unwrap()
                .into_response()
        }
    }
}

