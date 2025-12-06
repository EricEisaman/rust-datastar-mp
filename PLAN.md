# Multiplayer Chat Metroidvania Game Plan

## Project Structure

Create a monorepo with clear separation between server and client:

```
rust-datastar-mp/
├── server/              # Rust backend
│   ├── Cargo.toml       # Workspace root
│   ├── api/             # Axum + Datastar HTTP/SSE server
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs
│   │       ├── handlers/
│   │       │   ├── mod.rs
│   │       │   ├── events.rs    # SSE endpoint for Datastar patches
│   │       │   ├── chat.rs      # Chat message handlers
│   │       │   ├── game.rs      # Game state handlers
│   │       │   └── health.rs    # Health check endpoint
│   │       ├── state.rs         # AppState with shared channels
│   │       └── routes.rs        # Axum route definitions
│   └── game_core/       # Domain logic (game state, physics)
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── player.rs        # Player struct and movement logic
│           ├── game_state.rs    # Authoritative game state
│           ├── physics.rs       # Gravity, collision, movement
│           └── commands.rs      # Player input commands
├── client/              # Vuetify TypeScript frontend
│   ├── package.json
│   ├── tsconfig.json    # Strict mode, no any, no type casts
│   ├── vite.config.ts
│   ├── public/
│   │   └── index.html   # Entry point with Datastar attributes
│   └── src/
│       ├── main.ts      # Vuetify + Datastar initialization (VAPOR MODE)
│       ├── App.vue      # Root component with canvas + chat overlay
│       ├── components/
│       │   ├── GameCanvas.vue   # Canvas component for rendering
│       │   └── ChatOverlay.vue  # Vuetify chat UI overlay
│       ├── game/
│       │   ├── renderer.ts      # Canvas rendering logic
│       │   ├── input.ts          # Keyboard input handling
│       │   └── prediction.ts    # Client-side prediction
│       └── datastar-boot.ts     # Datastar SSE connection setup
├── shared/              # Optional: shared types/protocols
├── render.yaml          # Render.com deployment configuration
└── README.md
```

## Server Implementation (Rust)

### Core Dependencies

- `axum` - HTTP server framework
- `datastar` - Official Datastar Rust SDK
- `tokio` - Async runtime with `broadcast` and `mpsc` channels
- `serde` + `serde_json` - Serialization
- `uuid` - Player session IDs
- `tower-http` - Static file serving middleware

### Key Components

**1. Game State Management** (`game_core/src/game_state.rs`)

- Maintain authoritative state of all players (position, velocity, facing direction)
- Single shared room containing all players
- Use `HashMap<PlayerId, Player>` for O(1) lookups
- Game tick loop running at fixed interval (e.g., 60 Hz)

**2. Player Physics** (`game_core/src/physics.rs`)

- Basic Metroidvania mechanics:
    - Horizontal movement (left/right with acceleration/deceleration)
    - Jumping with gravity
    - Ground collision detection
    - Velocity clamping
- Server-authoritative: all movement validated on server

**3. Player Commands** (`game_core/src/commands.rs`)

- Define `PlayerCommand` enum (MoveLeft, MoveRight, Jump, Stop)
- Commands sent from client via HTTP POST
- Server validates and applies to game state

**4. Chat System** (`game_core/src/chat.rs`)

- `ChatMessage` struct with player_id, text, timestamp
- Messages stored in bounded queue (last N messages)
- Broadcast new messages to all connected clients

**5. SSE Handler** (`api/src/handlers/events.rs`)

- Single `/events` endpoint returning `Sse` stream
- Subscribe to broadcast channels for game state and chat updates
- Convert domain events to Datastar patches:
    - `PatchElements` for player list, chat messages
    - `PatchSignals` for game state updates
- Stream patches as `text/event-stream`

**6. App State** (`api/src/state.rs`)

- `AppState` struct containing:
    - `game_state: Arc<RwLock<GameState>>`
    - `game_tx: broadcast::Sender<GameUpdate>`
    - `chat_tx: broadcast::Sender<ChatMessage>`
    - `command_rx: mpsc::Receiver<PlayerCommand>`
- Injected into Axum handlers via `State<AppState>`

**7. Game Loop Task** (`api/src/main.rs`)

- Spawn Tokio task running game tick loop
- Reads commands from `mpsc` channel
- Updates game state
- Broadcasts state deltas via `broadcast` channel

**8. PORT Environment Variable** (`api/src/main.rs`)

- Read `PORT` from environment using `std::env::var("PORT")`
- Default to `3000` for local development
- Parse as `u16` and bind server to `0.0.0.0:PORT` (required for Render)
- Example:
  ```rust
  let port = std::env::var("PORT")
      .unwrap_or_else(|_| "3000".to_string())
      .parse::<u16>()
      .expect("PORT must be a valid number");
  let addr = SocketAddr::from(([0, 0, 0, 0], port));
  ```

**9. Static File Serving** (`api/src/routes.rs`)

- Use `tower-http::ServeDir` to serve files from `client/dist/`
- Mount static file service at root path
- Fallback to `index.html` for SPA routing
- Serve static assets before API routes
- Example:
  ```rust
  use tower_http::services::ServeDir;
  
  let static_files = ServeDir::new("client/dist");
  let app = Router::new()
      .nest_service("/", static_files)
      .route("/api/*", api_routes)
      .fallback(serve_index_html);
  ```

**10. Health Check Endpoint** (`api/src/handlers/health.rs`)

- Create `/health` endpoint returning `200 OK` with JSON response
- Handler responds immediately without dependencies
- Used by Render for zero-downtime deployments
- Example:
  ```rust
  pub async fn health_check() -> impl IntoResponse {
      (StatusCode::OK, Json(serde_json::json!({"status": "ok"})))
  }
  ```

## Client Implementation (TypeScript + Vuetify)

### Vue Vapor Mode Requirements (MANDATORY - ENFORCED)

**Vue Vapor Mode** is an experimental feature in Vue 3.6+ that eliminates the Virtual DOM, compiling templates directly to optimized DOM operations for better performance and smaller bundle sizes. The entire application MUST operate in full vapor mode with strict enforcement:

1. **Vue Version**: MUST use Vue 3.6 or later (`vue@^3.6.0` in package.json)
2. **Application Initialization**: MUST use `createVaporApp` instead of `createApp` - this eliminates Virtual DOM runtime entirely
3. **All Components**: Every Single File Component (SFC) MUST use `<script setup vapor>` syntax - the `vapor` attribute is mandatory
4. **Composition API Only**: Only Composition API with `<script setup>` is supported - Options API is NOT available in vapor mode
5. **No Virtual DOM**: All components compile directly to DOM operations, bypassing Virtual DOM entirely
6. **Build Verification**: Add linting/build checks to ensure no component uses Options API or missing `vapor` attribute

### Core Dependencies

- `vue@^3.6.0` - Vue framework (vapor mode support required)
- `vuetify` - UI framework (must be compatible with vapor mode)
- `@starfederation/datastar` - Datastar client
- `@vueuse/core` - Vue composition utilities (vapor mode compatible)

### Key Components

**1. Application Initialization** (`src/main.ts`) - CRITICAL VAPOR MODE SETUP

- **MUST** use `createVaporApp` from `vue` instead of `createApp`
- Initialize Vuetify plugin
- Mount to DOM element
- Example implementation:
  ```typescript
  import { createVaporApp } from 'vue';
  import { createVuetify } from 'vuetify';
  import App from './App.vue';
  
  const app = createVaporApp(App);
  const vuetify = createVuetify({ /* config */ });
  app.use(vuetify);
  app.mount('#app');
  ```
- **NEVER** use `createApp` - this would include Virtual DOM runtime and break vapor mode

**2. Main App** (`src/App.vue`)

- **MUST** use `<script setup vapor>` (not just `<script setup>`)
- Fullscreen layout using Vuetify's `v-app`
- Canvas component covering full viewport
- Chat overlay positioned absolutely (top-right or bottom)
- Use Vuetify classes only (no custom CSS)
- Example:
  ```vue
  <script setup vapor>
  import { ref } from 'vue';
  // Component logic - Composition API only
  </script>
  <template>
    <v-app>
      <!-- Fullscreen layout -->
    </v-app>
  </template>
  ```

**3. Game Canvas** (`src/components/GameCanvas.vue`)

- **MUST** use `<script setup vapor>`
- HTML5 `<canvas>` element
- Reads game state from Datastar signals
- `requestAnimationFrame` loop calling renderer
- Handles keyboard input, sends commands to server via `data-post` attributes

**4. Canvas Renderer** (`src/game/renderer.ts`)

- Pure TypeScript module (no Vue dependencies)
- Renders players as simple shapes (rectangles or circles)
- Interpolates positions between server updates
- Draws ground/platforms for Metroidvania feel

**5. Input Handler** (`src/game/input.ts`)

- Keyboard event listeners (Arrow keys or WASD)
- Maps keys to `PlayerCommand` enum
- Sends commands via Datastar `data-post` to `/api/player/command`
- Prevents default browser behavior for game keys

**6. Client-Side Prediction** (`src/game/prediction.ts`)

- Immediately applies player's own commands locally
- Maintains predicted state separate from authoritative state
- Reconciles when server state arrives via Datastar
- Smooth interpolation for other players

**7. Chat Overlay** (`src/components/ChatOverlay.vue`)

- **MUST** use `<script setup vapor>`
- Vuetify `v-card` with `v-list` for messages
- Input field with `v-text-field`
- Uses Datastar `data-on:submit` to send messages
- Messages bound via `data-text` from Datastar signals
- Auto-scroll to latest message

**8. Datastar Boot** (`src/datastar-boot.ts`)

- Initialize Datastar client
- Configure SSE endpoint (`/events`)
- Set up signal subscriptions for game state and chat
- Handle connection lifecycle

**9. HTML Entry Point** (`public/index.html`)

- Minimal HTML with Datastar attributes
- `data-get` for initial page load
- `data-text` bindings for dynamic content
- Vuetify app mount point

### Vapor Mode Constraints and Limitations

- **No Options API**: Cannot use `export default { data(), methods: {}, ... }` syntax - Composition API only
- **No Global Properties**: Some Vue global properties may not be available in vapor mode
- **Experimental Status**: Feature is still in alpha/beta - thorough testing required
- **Composition API Only**: All components must use `<script setup>` with Composition API
- **Template Compilation**: Templates compile directly to DOM operations - ensure compatibility with all used features
- **TypeScript Config**: Ensure TypeScript is configured to recognize vapor mode syntax

## Data Flow

1. **Player Input**: Keyboard → `input.ts` → HTTP POST `/api/player/command` → Server validates → Updates game state
2. **Game State Sync**: Server game loop → Broadcast channel → SSE `/events` → Datastar patches → Client signals → Canvas renderer
3. **Chat**: User types message → `data-post` → Server adds to chat queue → Broadcast → SSE → Datastar → Chat UI updates

## TypeScript Strict Requirements

- Use discriminated unions for `PlayerCommand` and game state variants
- No `any` types - use `unknown` with type guards if needed (but avoid user-defined type guards per requirements)
- No type casts - use proper type narrowing
- No unused variables - enable strict TypeScript checks
- All Vuetify components use proper class props, no inline styles
- No user-defined type guards (per requirements)
- No timeouts (per requirements)
- No logs (per requirements)

## Vue Vapor Mode Enforcement Checklist

**CRITICAL**: The following must be enforced throughout the entire codebase:

1. ✅ **Application Bootstrap**: `src/main.ts` MUST use `createVaporApp` from `vue` - never `createApp`
2. ✅ **All SFCs**: Every `.vue` file MUST use `<script setup vapor>` - the `vapor` attribute is mandatory
3. ✅ **No Options API**: All components must use Composition API with `<script setup>` syntax only
4. ✅ **Vue Version**: `package.json` must specify `vue@^3.6.0` or later
5. ✅ **TypeScript Config**: Ensure TypeScript is configured to recognize vapor mode syntax
6. ✅ **Build Verification**: Add build-time checks or linting rules to ensure no component uses Options API or missing `vapor` attribute
7. ✅ **Component Examples**: All component examples in code must show `<script setup vapor>` syntax

## Render.com Deployment

### Complete render.yaml Configuration (FINAL VERSION)

Create `render.yaml` at project root with the following complete configuration:

```yaml
services:
  - type: web
    name: rust-datastar-mp
    env: rust
    plan: free
    branch: main
    preDeployCommand: cd client && npm ci && npm run build
    buildCommand: cd server/api && cargo build --release
    startCommand: ./server/api/target/release/api
    envVars:
      - key: PORT
        generateValue: true
      - key: RUST_LOG
        value: info
    healthCheckPath: /health
```

**Key Configuration Details:**

- `preDeployCommand`: Builds frontend first (installs dependencies and builds Vue app to `client/dist/`)
- `buildCommand`: Builds Rust server in release mode from `server/api` directory
- `startCommand`: Runs the compiled binary from release directory
- `PORT`: Render automatically provides this - server must read from environment
- `healthCheckPath`: Required for zero-downtime deployments on Render
- `branch`: Specifies which Git branch to deploy from (default: main)

### Build Process Flow

1. Render runs `preDeployCommand`: `cd client && npm ci && npm run build`
   - Installs npm dependencies
   - Builds Vue app (with vapor mode) to `client/dist/`
2. Render runs `buildCommand`: `cd server/api && cargo build --release`
   - Compiles Rust server in release mode
   - Binary output: `server/api/target/release/api`
3. Render runs `startCommand`: `./server/api/target/release/api`
   - Server starts, reads `PORT` from environment
   - Serves static files from `client/dist/` and handles API routes

### Server Configuration for Render (Implementation Details)

**1. PORT Environment Variable** (`api/src/main.rs`)

- Read `PORT` from environment using `std::env::var("PORT")`
- Default to `3000` for local development: `env::var("PORT").unwrap_or_else(|_| "3000".to_string())`
- Parse as `u16` and bind server to `0.0.0.0:PORT` (required for Render - cannot use `127.0.0.1`)
- Example:
  ```rust
  let port = std::env::var("PORT")
      .unwrap_or_else(|_| "3000".to_string())
      .parse::<u16>()
      .expect("PORT must be a valid number");
  let addr = SocketAddr::from(([0, 0, 0, 0], port));
  ```

**2. Static File Serving** (`api/src/routes.rs`)

- Use `tower-http::ServeDir` to serve files from `client/dist/`
- Mount static file service at root path using Axum's `nest_service`
- Fallback to `index.html` for SPA routing (serve `index.html` for all non-API routes)
- Serve static assets before API routes in route order
- Example:
  ```rust
  use tower_http::services::ServeDir;
  
  let static_files = ServeDir::new("client/dist");
  let app = Router::new()
      .nest_service("/", static_files)
      .route("/api/*", api_routes)
      .fallback(serve_index_html);
  ```

**3. Health Check Endpoint** (`api/src/handlers/health.rs`)

- Create `/health` endpoint returning `200 OK` with simple JSON response
- Handler must respond immediately without database or external dependencies
- Used by Render for zero-downtime deployments and health monitoring
- Example:
  ```rust
  pub async fn health_check() -> impl IntoResponse {
      (StatusCode::OK, Json(serde_json::json!({"status": "ok"})))
  }
  ```

## Testing Strategy

- Server: Unit tests for physics and game state logic in `game_core`
- Client: Component tests for Vue components
- Integration: Manual testing with multiple browser tabs

## Development Workflow

1. Start Rust server: `cd server && cargo run`
2. Start Vite dev server: `cd client && npm run dev`
3. Server serves static assets in production (client `dist/` folder)
4. Deploy to Render: Push to Git, Render detects `render.yaml` and deploys via Blueprints

